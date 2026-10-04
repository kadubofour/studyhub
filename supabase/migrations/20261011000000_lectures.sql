-- Lectures: recordings saved in parts of up to 20 minutes, with a transcript; and the
-- accurate-transcript seconds that Premium fair use counts (20 hours a calendar month, UTC).

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null check (length(title) between 1 and 200),
  recorded_at timestamptz not null default now(),
  duration_seconds int not null check (duration_seconds between 0 and 7200),
  audio_bytes bigint not null default 0 check (audio_bytes >= 0),
  mime text not null check (mime in ('audio/webm', 'audio/mp4', 'audio/ogg')),
  -- [{ path, start, duration, bytes, transcribed, segments? }] — at most 7 parts of 20 minutes
  parts jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) <= 7),
  -- [{ start, end, text }], seconds from the start of the lecture
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  transcript_status text not null default 'none' check (transcript_status in ('none', 'live', 'processing', 'done', 'failed')),
  transcript_source text check (transcript_source in ('browser', 'openai')),
  note_id uuid references public.notes on delete set null,
  created_at timestamptz not null default now()
);
create index lectures_user on public.lectures (user_id, recorded_at desc);
alter table public.lectures enable row level security;
create policy "own rows" on public.lectures for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and (note_id is null or public.owns_note(note_id)));

-- Audio: private, one folder per student, "<user id>/<lecture id>-<part>.<ext>"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lectures', 'lectures', false, 62914560, array['audio/webm', 'audio/mp4', 'audio/ogg']);
create policy "lectures: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'lectures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lectures: read own" on storage.objects for select to authenticated
  using (bucket_id = 'lectures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lectures: update own" on storage.objects for update to authenticated
  using (bucket_id = 'lectures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lectures: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'lectures' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Accurate-transcript seconds used; written by the server only
create table public.transcription_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  lecture_id uuid references public.lectures on delete set null,
  seconds int not null check (seconds between 0 and 7200),
  at timestamptz not null default now()
);
create index transcription_usage_user_at on public.transcription_usage (user_id, at);
alter table public.transcription_usage enable row level security;
create policy "read own usage" on public.transcription_usage for select using (user_id = (select auth.uid()));

-- Before transcribing a part: accurate transcripts are Premium, up to 20 hours (72000 s) a month
create function public.transcription_check(p_user uuid, p_seconds int) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  used int;
begin
  if p_seconds is null or p_seconds < 0 or p_seconds > 7200 then
    raise exception 'seconds must be between 0 and 7200' using errcode = '22023';
  end if;
  if not public.is_premium(p_user) then return 'premium_required'; end if;
  select coalesce(sum(u.seconds), 0) into used from public.transcription_usage u
   where u.user_id = p_user and u.at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  if used + p_seconds > 72000 then return 'fair_use'; end if;
  return 'ok';
end $$;

-- After a part is transcribed
create function public.transcription_record(p_user uuid, p_lecture uuid, p_seconds int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_seconds is null or p_seconds < 0 or p_seconds > 7200 then
    raise exception 'seconds must be between 0 and 7200' using errcode = '22023';
  end if;
  insert into public.transcription_usage (user_id, lecture_id, seconds) values (p_user, p_lecture, p_seconds);
end $$;

revoke execute on function public.transcription_check(uuid, int) from public, anon, authenticated;
grant execute on function public.transcription_check(uuid, int) to service_role;
revoke execute on function public.transcription_record(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.transcription_record(uuid, uuid, int) to service_role;
