-- One board for friends and groups. Null: the caller and their accepted friends. A group id: that group's
-- members, for a member only. Students who turned off show_on_boards are left off, except the caller's own row.
-- Unordered: the client sorts by the view it shows.
create function public.leaderboard(p_group uuid default null)
returns table (user_id uuid, display_name text, avatar_color text, total_xp int, week_xp int, streak int, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_group is not null and not exists (
    select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = me
  ) then
    raise exception 'not_member';
  end if;
  return query
  select p.id, coalesce(p.display_name, 'Student'), p.avatar_color, x.total, x.week, x.streak, p.id = me
    from (
      select gm.user_id as uid from public.group_members gm where p_group is not null and gm.group_id = p_group
      union
      select me where p_group is null
      union
      select case when f.a = me then f.b else f.a end
        from public.friendships f where p_group is null and (f.a = me or f.b = me)
    ) m
    join public.profiles p on p.id = m.uid
    cross join lateral public.xp_totals(p.id) x
   where p.show_on_boards or p.id = me;
end $$;
revoke execute on function public.leaderboard(uuid) from public, anon;
grant execute on function public.leaderboard(uuid) to authenticated;
