-- Study groups, part 2: a limit on new groups, and a deleted account hands its groups on like leaving does.

-- At most 10 new groups an hour per student. (A refused create logs nothing that needs keeping.)
create or replace function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  gid uuid;
begin
  if me is null then raise exception 'not_found'; end if;
  perform public.social_rate('create_group', 10);
  insert into public.study_groups (name, owner_id, invite_token)
    values (public.clean_group_name(p_name), me, public.gen_group_token())
    returning id into gid;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return gid;
end $$;

-- Deleting an account is leaving: each group it owns goes to the member who has been in longest,
-- and is deleted only when nobody else is left. Runs before the account's rows are removed.
create function public.hand_on_groups() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
  heir uuid;
begin
  for gid in select id from public.study_groups where owner_id = old.id order by id for update loop
    select m.user_id into heir from public.group_members m
     where m.group_id = gid and m.user_id <> old.id order by m.joined_at, m.user_id limit 1;
    if heir is null then
      delete from public.study_groups where id = gid;
    else
      update public.study_groups set owner_id = heir where id = gid;
    end if;
  end loop;
  return old;
end $$;
create trigger hand_on_groups before delete on auth.users
  for each row execute function public.hand_on_groups();

revoke execute on function public.create_group(text), public.hand_on_groups() from public, anon, authenticated;
grant execute on function public.create_group(text) to authenticated;
