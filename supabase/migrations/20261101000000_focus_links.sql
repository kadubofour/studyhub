-- A focus session can say what it was spent on: a task and its course, both optional, and only the student's own
alter table public.focus_sessions
  add column task_id uuid references public.tasks on delete set null,
  add column course_id uuid references public.courses on delete set null;

drop policy "own rows" on public.focus_sessions;
create policy "own rows" on public.focus_sessions for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (task_id is null or public.owns_task(task_id)) and public.owns_course(course_id));
