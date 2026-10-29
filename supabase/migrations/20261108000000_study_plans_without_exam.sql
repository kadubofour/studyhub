-- A study plan no longer needs an exam. Any course can have one: with an exam it works towards that day, without one it
-- keeps going, planning the next two weeks each day. The exam is a target the student can add, change or take away.

-- 1) The exam is optional, and deleting the exam task leaves the plan in place without one (it used to delete the plan)
alter table public.study_plans alter column exam_task_id drop not null;
alter table public.study_plans drop constraint study_plans_exam_task_id_fkey;
alter table public.study_plans add constraint study_plans_exam_task_id_fkey
  foreign key (exam_task_id) references public.tasks on delete set null;

-- 2) A plan is for the student's own course, and for their own exam when it has one
drop policy "own rows" on public.study_plans;
create policy "own rows" on public.study_plans for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and (exam_task_id is null or public.owns_task(exam_task_id)));

-- 3) When a plan names an exam, it must still be an exam task in the plan's course
create or replace function public.study_plan_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  exam_type text;
  exam_course uuid;
begin
  if new.exam_task_id is null then return new; end if;
  select t.type, t.course_id into exam_type, exam_course from public.tasks t where t.id = new.exam_task_id;
  if exam_type is distinct from 'exam' or exam_course is distinct from new.course_id then
    raise exception 'A study plan needs an exam task in the same course' using errcode = '23514';
  end if;
  return new;
end $$;
