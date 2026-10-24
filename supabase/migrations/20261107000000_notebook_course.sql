-- A notebook can belong to a course, whose colour it takes (docs/superpowers/specs/2026-10-31-notebook-pages-design.md).
-- Deleting the course leaves the notebook without one.
alter table public.notebooks add column course_id uuid references public.courses on delete set null;

-- Only the student's own course
drop policy "own rows" on public.notebooks;
create policy "own rows" on public.notebooks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));
