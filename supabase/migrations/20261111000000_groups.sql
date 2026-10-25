-- Study groups: up to 50 students, joined with a private invite link. Members may read their groups and the
-- member rows. Every write goes through the functions below.

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner_id uuid not null references auth.users on delete cascade,
  invite_token text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.study_groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id on public.group_members (user_id);

alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;

-- Used by the read policies. Runs as the system so the policy on group_members does not look at itself.
create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members
                  where group_id = p_group and user_id = (select auth.uid()))
$$;

create policy "members read their groups" on public.study_groups for select
  using (public.is_group_member(id));
create policy "members read member rows" on public.group_members for select
  using (public.is_group_member(group_id));

revoke insert, update, delete on public.study_groups, public.group_members from anon, authenticated;

-- An invite token is 244 random bits as 64 hex characters (gen_random_uuid is built in, no extension needed).
create function public.gen_group_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

-- Makes the name tidy and checks it is 1-60 characters.
create function public.clean_group_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  n text := btrim(coalesce(p_name, ''));
begin
  if char_length(n) not between 1 and 60 then raise exception 'invalid_name'; end if;
  return n;
end $$;

-- Locks the group row and checks the caller owns it. Everyone else (including for a group that is not there)
-- gets not_owner, so nothing is revealed about groups the caller is not in.
create function public.lock_owned_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.study_groups
   where id = p_group and owner_id = (select auth.uid()) for update;
  if not found then raise exception 'not_owner'; end if;
end $$;

create function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  gid uuid;
begin
  if me is null then raise exception 'not_found'; end if;
  insert into public.study_groups (name, owner_id, invite_token)
    values (public.clean_group_name(p_name), me, public.gen_group_token())
    returning id into gid;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return gid;
end $$;

-- Joining with an invite. A raised error would roll back the attempt's log row, so failures must not raise:
-- it returns a status ('ok', 'not_found', 'group_full' or 'rate_limited') and the group id on success.
-- Every attempt counts toward 20 an hour. Joining a group you are already in is a quiet success.
create function public.join_group(p_token text) returns table (status text, group_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  gid uuid;
begin
  if me is null then return query select 'not_found'::text, null::uuid; return; end if;
  if not public.social_attempt('join_group', 20) then
    return query select 'rate_limited'::text, null::uuid; return;
  end if;
  -- The group row stays locked until we commit, so two joins cannot both take the last place.
  select g.id into gid from public.study_groups g where g.invite_token = btrim(p_token) for update;
  if gid is null then return query select 'not_found'::text, null::uuid; return; end if;
  if exists (select 1 from public.group_members m where m.group_id = gid and m.user_id = me) then
    return query select 'ok'::text, gid; return;
  end if;
  if (select count(*) from public.group_members m where m.group_id = gid) >= 50 then
    return query select 'group_full'::text, null::uuid; return;
  end if;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return query select 'ok'::text, gid;
end $$;

-- The owner leaving hands the group to the member who has been in longest; the last one out deletes it.
create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  g public.study_groups;
  heir uuid;
begin
  select * into g from public.study_groups where id = p_group for update;
  if not found or not exists (select 1 from public.group_members where group_id = p_group and user_id = me) then
    raise exception 'not_member';
  end if;
  delete from public.group_members where group_id = p_group and user_id = me;
  if g.owner_id = me then
    select m.user_id into heir from public.group_members m
     where m.group_id = p_group order by m.joined_at, m.user_id limit 1;
    if heir is null then
      delete from public.study_groups where id = p_group;
    else
      update public.study_groups set owner_id = heir where id = p_group;
    end if;
  end if;
end $$;

create function public.rename_group(p_group uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_owned_group(p_group);
  update public.study_groups set name = public.clean_group_name(p_name) where id = p_group;
end $$;

create function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_owned_group(p_group);
  if p_user = (select auth.uid()) then raise exception 'self'; end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
end $$;

-- A new invite replaces the old one, which stops working.
create function public.new_group_invite(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text := public.gen_group_token();
begin
  perform public.lock_owned_group(p_group);
  update public.study_groups set invite_token = t where id = p_group;
  return t;
end $$;

create function public.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_owned_group(p_group);
  delete from public.study_groups where id = p_group;
end $$;

-- The token is shown to the owner only.
create function public.my_groups()
returns table (id uuid, name text, is_owner boolean, members int, invite_token text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.owner_id = (select auth.uid()),
         (select count(*)::int from public.group_members c where c.group_id = g.id),
         case when g.owner_id = (select auth.uid()) then g.invite_token end
    from public.study_groups g
    join public.group_members m on m.group_id = g.id and m.user_id = (select auth.uid())
   order by m.joined_at, g.id
$$;

-- Names and colours of the people in a group the caller is in. Nothing for anyone else.
create function public.group_members_of(p_group uuid)
returns table (user_id uuid, display_name text, avatar_color text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name, p.avatar_color, m.user_id = g.owner_id
    from public.study_groups g
    join public.group_members m on m.group_id = g.id
    join public.profiles p on p.id = m.user_id
   where g.id = p_group and public.is_group_member(p_group)
   order by m.joined_at, m.user_id
$$;

-- For the join page: name and size only, to any signed-in student holding the link.
create function public.group_preview(p_token text) returns table (name text, members int)
language sql stable security definer set search_path = '' as $$
  select g.name, (select count(*)::int from public.group_members m where m.group_id = g.id)
    from public.study_groups g
   where (select auth.uid()) is not null and g.invite_token = btrim(p_token)
$$;

revoke execute on function
  public.is_group_member(uuid), public.gen_group_token(), public.clean_group_name(text),
  public.lock_owned_group(uuid), public.create_group(text), public.join_group(text), public.leave_group(uuid),
  public.rename_group(uuid, text), public.remove_member(uuid, uuid), public.new_group_invite(uuid),
  public.delete_group(uuid), public.my_groups(), public.group_members_of(uuid), public.group_preview(text)
  from public, anon, authenticated;
-- The read policies call this one as the signed-in student.
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function
  public.create_group(text), public.join_group(text), public.leave_group(uuid),
  public.rename_group(uuid, text), public.remove_member(uuid, uuid), public.new_group_invite(uuid),
  public.delete_group(uuid), public.my_groups(), public.group_members_of(uuid), public.group_preview(text)
  to authenticated;
