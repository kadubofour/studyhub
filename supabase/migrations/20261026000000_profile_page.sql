-- The profile page: who the student is (school, programme, avatar colour) and what they have done (counts)
alter table public.profiles
  add column school text check (school is null or length(school) between 1 and 80),
  add column programme text check (programme is null or length(programme) between 1 and 80),
  add column avatar_color text not null default '#3B5BDB' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$');

-- A name is at most 80 characters (not checked against names saved before today)
alter table public.profiles add constraint profiles_display_name_len check (display_name is null or length(display_name) between 1 and 80) not valid;

-- One row of totals for the signed-in student. Security invoker: row level security keeps every count to their own rows.
create function public.profile_stats()
returns table (notes int, decks int, cards int, lectures int, lecture_minutes int, quizzes_done int, focus_minutes int, reviews int, games int, tutor_messages int, courses int)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*)::int from public.notes where user_id = (select auth.uid())),
    (select count(*)::int from public.decks where user_id = (select auth.uid())),
    (select count(*)::int from public.cards where user_id = (select auth.uid())),
    (select count(*)::int from public.lectures where user_id = (select auth.uid())),
    (select (coalesce(sum(duration_seconds), 0) / 60)::int from public.lectures where user_id = (select auth.uid())),
    (select count(*)::int from public.quiz_attempts where user_id = (select auth.uid()) and finished_at is not null),
    (select coalesce(sum(minutes), 0)::int from public.focus_sessions where user_id = (select auth.uid())),
    (select count(*)::int from public.reviews where user_id = (select auth.uid())),
    (select count(*)::int from public.game_plays where user_id = (select auth.uid())),
    (select count(*)::int from public.tutor_messages where user_id = (select auth.uid()) and role = 'user'),
    (select count(*)::int from public.courses where user_id = (select auth.uid()))
$$;
