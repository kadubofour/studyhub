-- Review fixes for study plans.
-- 1) The exam check ran on every update of a plan, so editing its minutes failed once its exam task had been changed.
--    It now runs when a plan is made and when it is pointed at another exam or course.
drop trigger study_plan_check on public.study_plans;
create trigger study_plan_check before insert or update of exam_task_id, course_id on public.study_plans
  for each row execute function public.study_plan_check();

-- 2) Making a plan replaces an old one only when that one has ended (its exam is done, has no date, or has
--    passed), in one transaction. A live plan is never touched: the insert then fails on the one-plan-per-course rule.
create function public.create_study_plan(p_course uuid, p_exam uuid, p_mode text, p_minutes int, p_days_off int[]) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pid uuid;
begin
  delete from public.study_plans p using public.tasks t
   where p.course_id = p_course and t.id = p.exam_task_id
     and (t.done_at is not null or t.due_at is null or t.due_at <= now());
  insert into public.study_plans (course_id, exam_task_id, mode, minutes_per_day, days_off)
  values (p_course, p_exam, p_mode, p_minutes, p_days_off) returning id into pid;
  return pid;
end $$;
