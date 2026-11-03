-- A quiz can be on anything the student asks for, so it no longer has to come from a note. One made from a note is still deleted with it.
alter table public.quizzes alter column note_id drop not null;

drop policy "own rows" on public.quizzes;
create policy "own rows" on public.quizzes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (note_id is null or public.owns_note(note_id)));
