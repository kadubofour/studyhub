-- Profiles are created by the signup trigger and must always exist while the account does
-- (the app redirects without one). Owners may read and update theirs, not insert or delete.
drop policy "own profile" on public.profiles;
create policy "read own profile" on public.profiles for select
  using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
