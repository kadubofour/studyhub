-- Phase 3A: the AI tutor. Chats and messages, finding the student's own material, and the tutor's
-- own message allowance (Free: 20 a day; Premium: counts toward the 400 a month fair use).

create function public.owns_lecture(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lectures l where l.id = lid and l.user_id = auth.uid())
$$;

create table public.tutor_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'New chat' check (length(title) between 1 and 200),
  course_id uuid references public.courses on delete set null,
  note_id uuid references public.notes on delete set null,
  lecture_id uuid references public.lectures on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (note_id is null or lecture_id is null)
);
create index tutor_chats_user on public.tutor_chats (user_id, updated_at desc);
create trigger tutor_chats_touch before update on public.tutor_chats
  for each row execute function public.touch_updated_at();
alter table public.tutor_chats enable row level security;
create policy "own rows" on public.tutor_chats for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id)
    and (note_id is null or public.owns_note(note_id)) and (lecture_id is null or public.owns_lecture(lecture_id)));

create function public.owns_tutor_chat(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tutor_chats c where c.id = cid and c.user_id = auth.uid())
$$;

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.tutor_chats on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (length(content) <= 40000),
  -- [{ kind: 'note'|'lecture'|'card', id, title }]
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  -- [{ id, tool, args, state: 'pending'|'added'|'discarded', itemId?, itemKind? }]
  proposals jsonb not null default '[]'::jsonb check (jsonb_typeof(proposals) = 'array'),
  status text not null default 'ok' check (status in ('ok', 'cut_off')),
  created_at timestamptz not null default now()
);
create index tutor_messages_chat on public.tutor_messages (chat_id, created_at);
alter table public.tutor_messages enable row level security;
create policy "own rows" on public.tutor_messages for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_tutor_chat(chat_id));

-- ---- Limits ---------------------------------------------------------------------------------
-- ai_charges now says what a charge was for. The Free daily 10 counts AI actions only.
alter table public.ai_charges add column kind text not null default 'action' check (kind in ('action', 'tutor'));

create or replace function public.ai_check(p_user uuid, p_cost int) returns text
language plpgsql security definer set search_path = '' as $$
declare
  used int;
begin
  if p_cost is null or p_cost < 0 or p_cost > 10 then
    raise exception 'AI cost must be between 0 and 10' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if (select count(*) from public.ai_requests r where r.user_id = p_user and r.at > now() - interval '60 seconds') >= 10 then
    return 'rate_limited';
  end if;
  if p_cost > 0 then
    if public.is_premium(p_user) then
      select coalesce(sum(c.cost), 0) into used from public.ai_charges c
       where c.user_id = p_user and c.at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
      if used + p_cost > 400 then return 'fair_use'; end if;
    else
      select coalesce(sum(c.cost), 0) into used from public.ai_charges c
       where c.user_id = p_user and c.kind = 'action' and c.at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
      if used + p_cost > 10 then return 'daily_limit'; end if;
    end if;
    insert into public.ai_charges (user_id, cost, kind) values (p_user, p_cost, 'action');
  end if;
  insert into public.ai_requests (user_id) values (p_user);
  delete from public.ai_requests r where r.user_id = p_user and r.at < now() - interval '1 day';
  return 'ok';
end $$;

create or replace function public.ai_release(p_user uuid, p_cost int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.ai_charges c where c.id = (
    select c2.id from public.ai_charges c2
     where c2.user_id = p_user and c2.cost = p_cost and c2.kind = 'action' order by c2.at desc, c2.id desc limit 1
  );
end $$;

-- Before a tutor message: the speed limit, then Free's 20 a day or Premium's fair use. An ok
-- reserves the message under the same lock, so parallel messages can't overshoot.
create function public.tutor_check(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  used int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if (select count(*) from public.ai_requests r where r.user_id = p_user and r.at > now() - interval '60 seconds') >= 10 then
    return 'rate_limited';
  end if;
  if public.is_premium(p_user) then
    select coalesce(sum(c.cost), 0) into used from public.ai_charges c
     where c.user_id = p_user and c.at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
    if used + 1 > 400 then return 'fair_use'; end if;
  else
    select count(*) into used from public.ai_charges c
     where c.user_id = p_user and c.kind = 'tutor' and c.at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    if used + 1 > 20 then return 'tutor_limit'; end if;
  end if;
  insert into public.ai_charges (user_id, cost, kind) values (p_user, 1, 'tutor');
  insert into public.ai_requests (user_id) values (p_user);
  delete from public.ai_requests r where r.user_id = p_user and r.at < now() - interval '1 day';
  return 'ok';
end $$;

-- After a failed tutor call: give the message back
create function public.tutor_release(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.ai_charges c where c.id = (
    select c2.id from public.ai_charges c2 where c2.user_id = p_user and c2.kind = 'tutor' order by c2.at desc, c2.id desc limit 1
  );
end $$;

revoke execute on function public.tutor_check(uuid) from public, anon, authenticated;
revoke execute on function public.tutor_release(uuid) from public, anon, authenticated;
grant execute on function public.tutor_check(uuid) to service_role;
grant execute on function public.tutor_release(uuid) to service_role;

-- ---- Finding the student's own material -----------------------------------------------------
-- Runs as the student (security invoker): row-level security shows only their notes, lectures and
-- cards. websearch_to_tsquery never errors on odd input. Computed at query time (see the plan).
create function public.tutor_find_material(p_query text, p_limit int default 5)
returns table (kind text, id uuid, title text, snippet text)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('english', coalesce(p_query, '')) as tsq),
  docs as (
    select 'note'::text as kind, n.id, n.title, n.content_md as body from public.notes n
    union all
    select 'lecture', l.id, l.title, coalesce((select string_agg(t->>'text', ' ') from jsonb_array_elements(l.transcript) t), '') from public.lectures l
    union all
    select 'card', c.id, left(c.front, 80), c.front || ' ' || c.back from public.cards c
  )
  select d.kind, d.id, d.title, left(d.body, 2000) as snippet
    from docs d, q
   where q.tsq::text <> '' and to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.body, '')) @@ q.tsq
   order by ts_rank(to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.body, '')), q.tsq) desc
   limit least(greatest(coalesce(p_limit, 5), 1), 10)
$$;
grant execute on function public.tutor_find_material(text, int) to authenticated;
