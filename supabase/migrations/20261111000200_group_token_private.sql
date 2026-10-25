-- The invite token must not be readable from the table: a member could copy it, and a new invite would not
-- stop a leaked link. Students read groups by these columns only; the owner gets the token through my_groups.
revoke select on public.study_groups from anon, authenticated;
grant select (id, name, owner_id, created_at) on public.study_groups to authenticated;
revoke select on public.group_members from anon;
