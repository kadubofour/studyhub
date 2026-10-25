-- XP worked out on the server, from on-time records only, in each student's own time zone.
-- The numbers here must equal lib/xp/rules.ts (dayXp): per-unit XP, daily caps, focus units of 5 minutes,
-- and a 20 XP bonus on a day with 10+ reviews, 25+ focus minutes and a finished quiz.

create function public.xp_days(p_user uuid)
returns table (day date, xp int)
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text;
begin
  select timezone into tz from public.profiles where id = p_user;
  if tz is null then return; end if;
  return query
  with ev as (
    select (reviewed_at at time zone tz)::date as d, 1 as r, 0 as q, 0 as f, 0 as t, 0 as p, 0 as m, 0 as l, 0 as g
      from public.reviews where user_id = p_user and public.on_time(reviewed_at, received_at)
    union all
    select (finished_at at time zone tz)::date, 0, 1, 0, 0, 0, 0, 0, 0
      from public.quiz_attempts
      where user_id = p_user and finished_at is not null and public.on_time(finished_at, finished_received_at)
    union all
    select (started_at at time zone tz)::date, 0, 0, minutes, 0, 0, 0, 0, 0
      from public.focus_sessions where user_id = p_user and public.on_time(started_at, received_at)
    union all
    select (done_at at time zone tz)::date, 0, 0, 0, 1, 0, 0, 0, 0
      from public.tasks where user_id = p_user and done_at is not null and public.on_time(done_at, done_received_at)
    union all
    select ((s ->> 'done_at')::timestamptz at time zone tz)::date, 0, 0, 0, 0, 1, 0, 0, 0
      from public.study_plan_days pd, jsonb_array_elements(pd.sessions) s
      where pd.user_id = p_user and s ->> 'done_at' is not null
        and public.on_time((s ->> 'done_at')::timestamptz, (s ->> 'done_received_at')::timestamptz)
    union all
    select (created_at at time zone tz)::date, 0, 0, 0, 0, 0, 1, 0, 0
      from public.tutor_messages where user_id = p_user and role = 'user' and public.on_time(created_at, received_at)
    union all
    select (recorded_at at time zone tz)::date, 0, 0, 0, 0, 0, 0, 1, 0
      from public.lectures where user_id = p_user and public.on_time(recorded_at, received_at)
    union all
    select (created_at at time zone tz)::date, 0, 0, 0, 0, 0, 0, 0, 1
      from public.game_plays where user_id = p_user and public.on_time(created_at, received_at)
  ),
  per as (
    select ev.d, sum(r)::int as r, sum(q)::int as q, sum(f)::int as f, sum(t)::int as t,
           sum(p)::int as p, sum(m)::int as m, sum(l)::int as l, sum(g)::int as g
    from ev group by ev.d
  )
  select per.d,
    (least(per.r, 50) * 1 + least(per.q, 5) * 10 + least(per.f / 5, 24) * 1 + least(per.t, 10) * 5
     + least(per.p, 8) * 8 + least(per.m, 10) * 2 + least(per.l, 2) * 15 + least(per.g, 3) * 8
     + case when per.r >= 10 and per.f >= 25 and per.q >= 1 then 20 else 0 end)::int
  from per
  where (least(per.r, 50) * 1 + least(per.q, 5) * 10 + least(per.f / 5, 24) * 1 + least(per.t, 10) * 5
     + least(per.p, 8) * 8 + least(per.m, 10) * 2 + least(per.l, 2) * 15 + least(per.g, 3) * 8
     + case when per.r >= 10 and per.f >= 25 and per.q >= 1 then 20 else 0 end) > 0
  order by per.d desc;
end $$;
revoke execute on function public.xp_days(uuid) from public, anon, authenticated;

create function public.my_xp_days()
returns table (day date, xp int)
language sql stable security definer set search_path = '' as $$
  select * from public.xp_days((select auth.uid()))
$$;
revoke execute on function public.my_xp_days() from public, anon;
grant execute on function public.my_xp_days() to authenticated;

create function public.xp_totals(p_user uuid)
returns table (total int, week int, streak int)
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text;
  today date;
  d date;
  n int := 0;
  active date[];
  tot int;
  wk int;
begin
  select timezone into tz from public.profiles where id = p_user;
  if tz is null then
    return query select 0, 0, 0;
    return;
  end if;
  today := (now() at time zone tz)::date;
  select coalesce(array_agg(x.day), '{}'), coalesce(sum(x.xp), 0)::int,
         coalesce(sum(x.xp) filter (where x.day >= date_trunc('week', today::timestamp)::date and x.day <= today), 0)::int
    into active, tot, wk
    from public.xp_days(p_user) x;
  d := case when today = any(active) then today else today - 1 end;
  while d = any(active) loop
    n := n + 1; d := d - 1;
  end loop;
  return query select tot, wk, n;
end $$;
revoke execute on function public.xp_totals(uuid) from public, anon, authenticated;
