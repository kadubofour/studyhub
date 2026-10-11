-- What the student has done, counted per local day, for XP and daily goals.
-- Read-only and security invoker: row level security keeps it to the student's own rows.
create function public.activity_by_day(p_tz text)
returns table (day date, reviews int, quizzes int, focus_minutes int, tasks_done int, plan_sessions int, tutor_messages int, lectures int)
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform now() at time zone p_tz; -- an unknown time zone fails here, even when there is nothing to count
  return query
  with ev as (
    select (reviewed_at at time zone p_tz)::date as d, 1 as r, 0 as q, 0 as f, 0 as t, 0 as p, 0 as m, 0 as l
      from public.reviews where user_id = (select auth.uid())
    union all
    select (finished_at at time zone p_tz)::date, 0, 1, 0, 0, 0, 0, 0
      from public.quiz_attempts where user_id = (select auth.uid()) and finished_at is not null
    union all
    select (started_at at time zone p_tz)::date, 0, 0, minutes, 0, 0, 0, 0
      from public.focus_sessions where user_id = (select auth.uid())
    union all
    select (done_at at time zone p_tz)::date, 0, 0, 0, 1, 0, 0, 0
      from public.tasks where user_id = (select auth.uid()) and done_at is not null
    union all
    select ((s ->> 'done_at')::timestamptz at time zone p_tz)::date, 0, 0, 0, 0, 1, 0, 0
      from public.study_plan_days pd, jsonb_array_elements(pd.sessions) s
      where pd.user_id = (select auth.uid()) and s ->> 'done_at' is not null
    union all
    select (created_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 1, 0
      from public.tutor_messages where user_id = (select auth.uid()) and role = 'user'
    union all
    select (recorded_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 0, 1
      from public.lectures where user_id = (select auth.uid())
  )
  select ev.d, sum(r)::int, sum(q)::int, sum(f)::int, sum(t)::int, sum(p)::int, sum(m)::int, sum(l)::int
  from ev group by ev.d order by ev.d;
end $$;
