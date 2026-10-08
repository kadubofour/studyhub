-- U2b: study plans (one per course, built from an exam task) and each day's saved list of sessions.

create function public.owns_task(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks t where t.id = tid and t.user_id = auth.uid())
$$;

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  exam_task_id uuid not null references public.tasks on delete cascade,
  mode text not null default 'balanced' check (mode in ('sprint', 'balanced', 'deep')),
  minutes_per_day int not null default 45 check (minutes_per_day between 10 and 240),
  -- weekday numbers, 0 is Sunday
  days_off int[] not null default '{}' check (days_off <@ array[0, 1, 2, 3, 4, 5, 6]),
  created_at timestamptz not null default now(),
  unique (course_id)
);
alter table public.study_plans enable row level security;
create policy "own rows" on public.study_plans for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and public.owns_task(exam_task_id));

-- The exam must be an exam task in the plan's course
create function public.study_plan_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  exam_type text;
  exam_course uuid;
begin
  select t.type, t.course_id into exam_type, exam_course from public.tasks t where t.id = new.exam_task_id;
  if exam_type is distinct from 'exam' or exam_course is distinct from new.course_id then
    raise exception 'A study plan needs an exam task in the same course' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger study_plan_check before insert or update on public.study_plans for each row execute function public.study_plan_check();

create function public.owns_plan(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_plans p where p.id = pid and p.user_id = auth.uid())
$$;

-- A day's saved sessions: [{ id, topic_id, kind: 'warmup'|'learn'|'revise', minutes, done_at }]
create table public.study_plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id uuid not null references public.study_plans on delete cascade,
  day date not null,
  sessions jsonb not null default '[]'::jsonb check (jsonb_typeof(sessions) = 'array'),
  created_at timestamptz not null default now(),
  unique (plan_id, day)
);
alter table public.study_plan_days enable row level security;
create policy "own rows" on public.study_plan_days for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_plan(plan_id));
