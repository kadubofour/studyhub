-- Visual lessons: the tutor explains an answer step by step with a drawing that builds up and a spoken voiceover.
-- A lesson is a script (what to draw, what to say) kept with its chat; the voice of each step is a file in the private
-- "lessons" bucket, at "<user id>/<chat id>/<lesson id>-<step>.mp3", so deleting a chat clears them along with its other files.
create table public.tutor_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chat_id uuid not null references public.tutor_chats on delete cascade,
  -- the reply it explains, so the chat can show it under that reply (kept if the reply is deleted)
  message_id uuid,
  title text not null check (length(title) between 1 and 200),
  -- { elements: [...], steps: [{ narration, show, focus, audio? }] }, checked by the app before it is saved
  script jsonb not null check (jsonb_typeof(script) = 'object'),
  created_at timestamptz not null default now()
);
create index tutor_lessons_chat on public.tutor_lessons (chat_id, created_at);
alter table public.tutor_lessons enable row level security;
create policy "own rows" on public.tutor_lessons for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_tutor_chat(chat_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lessons', 'lessons', false, 5242880, array['audio/mpeg']);
create policy "lessons: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'lessons' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lessons: read own" on storage.objects for select to authenticated
  using (bucket_id = 'lessons' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lessons: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'lessons' and (storage.foldername(name))[1] = (select auth.uid())::text);
