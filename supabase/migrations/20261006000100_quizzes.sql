-- Quizzes made from a note, and attempts (score history).
create function public.owns_note(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n where n.id = nid and n.user_id = auth.uid())
$$;

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  note_id uuid not null references public.notes on delete cascade,
  title text not null check (length(title) between 1 and 200),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 3 and 30),
  created_at timestamptz not null default now()
);
create index quizzes_note on public.quizzes (note_id, created_at);

create function public.owns_quiz(qid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quizzes q where q.id = qid and q.user_id = auth.uid())
$$;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quiz_id uuid not null references public.quizzes on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  correct int not null default 0 check (correct >= 0),
  total int not null check (total between 1 and 30),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (correct <= total)
);
create index quiz_attempts_quiz on public.quiz_attempts (quiz_id, started_at);
create index quiz_attempts_finished on public.quiz_attempts (user_id, finished_at);

alter table public.quizzes enable row level security;
create policy "own rows" on public.quizzes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_note(note_id));
alter table public.quiz_attempts enable row level security;
create policy "own rows" on public.quiz_attempts for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_quiz(quiz_id));
