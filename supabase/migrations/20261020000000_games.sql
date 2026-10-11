-- Plays of the study games (Match, Speed round) made from a deck's cards; they earn a little XP.
create table public.game_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid references public.decks on delete set null,
  game text not null check (game in ('match', 'speed')),
  score int not null check (score >= 0),
  total int not null check (total between 1 and 30),
  created_at timestamptz not null default now(),
  check (score <= total)
);
create index game_plays_user_time on public.game_plays (user_id, created_at);
alter table public.game_plays enable row level security;
create policy "own rows" on public.game_plays for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (deck_id is null or public.owns_deck(deck_id)));

-- activity_by_day gains a games count
drop function public.activity_by_day(text);
create function public.activity_by_day(p_tz text)
returns table (day date, reviews int, quizzes int, focus_minutes int, tasks_done int, plan_sessions int, tutor_messages int, lectures int, games int)
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform now() at time zone p_tz; -- an unknown time zone fails here, even when there is nothing to count
  return query
  with ev as (
    select (reviewed_at at time zone p_tz)::date as d, 1 as r, 0 as q, 0 as f, 0 as t, 0 as p, 0 as m, 0 as l, 0 as g
      from public.reviews where user_id = (select auth.uid())
    union all
    select (finished_at at time zone p_tz)::date, 0, 1, 0, 0, 0, 0, 0, 0
      from public.quiz_attempts where user_id = (select auth.uid()) and finished_at is not null
    union all
    select (started_at at time zone p_tz)::date, 0, 0, minutes, 0, 0, 0, 0, 0
      from public.focus_sessions where user_id = (select auth.uid())
    union all
    select (done_at at time zone p_tz)::date, 0, 0, 0, 1, 0, 0, 0, 0
      from public.tasks where user_id = (select auth.uid()) and done_at is not null
    union all
    select ((s ->> 'done_at')::timestamptz at time zone p_tz)::date, 0, 0, 0, 0, 1, 0, 0, 0
      from public.study_plan_days pd, jsonb_array_elements(pd.sessions) s
      where pd.user_id = (select auth.uid()) and s ->> 'done_at' is not null
    union all
    select (created_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 1, 0, 0
      from public.tutor_messages where user_id = (select auth.uid()) and role = 'user'
    union all
    select (recorded_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 0, 1, 0
      from public.lectures where user_id = (select auth.uid())
    union all
    select (created_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 0, 0, 1
      from public.game_plays where user_id = (select auth.uid())
  )
  select ev.d, sum(r)::int, sum(q)::int, sum(f)::int, sum(t)::int, sum(p)::int, sum(m)::int, sum(l)::int, sum(g)::int
  from ev group by ev.d order by ev.d;
end $$;
