-- Friends: a friend code per student, requests, "Add in person" codes, and the board setting.
-- Students may read only rows they are in. Every write goes through the functions below.

-- A student can hide from every board (friends and groups) without leaving anything.
alter table public.profiles add column show_on_boards boolean not null default true;

-- Social actions that are rate limited (requests, Add in person) are logged here, one row each.
create table public.social_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  action text not null,
  at timestamptz not null default now()
);
create index social_log_user_action_at on public.social_log (user_id, action, at desc);

-- A friend code is 8 characters with no look-alikes (no I, L, O, 0, 1). Retries on the rare clash.
create function public.new_friend_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c);
  end loop;
  return c;
end $$;

-- Back-fill existing students, then make the code required, unique and automatic for new sign-ups.
alter table public.profiles add column friend_code text;
alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);
update public.profiles set friend_code = public.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;
alter table public.profiles alter column friend_code set default public.new_friend_code();

-- The code is handed out by the system. Students can edit their profile, but not this.
create function public.keep_friend_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.friend_code := old.friend_code;
  return new;
end $$;
create trigger profiles_keep_friend_code before update of friend_code on public.profiles
  for each row execute function public.keep_friend_code();

-- Tables ------------------------------------------------------------------
create table public.friend_requests (
  from_id uuid not null references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to_id on public.friend_requests (to_id);

-- One row per pair, with the smaller id in "a", so a pair can never be stored twice.
create table public.friendships (
  a uuid not null references auth.users on delete cascade,
  b uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index friendships_b on public.friendships (b);

create table public.in_person_codes (
  code text primary key,
  user_id uuid not null unique references auth.users on delete cascade,
  expires_at timestamptz not null
);

alter table public.social_log enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.in_person_codes enable row level security;

create policy "read own social log" on public.social_log for select
  using (user_id = (select auth.uid()));
create policy "read own requests" on public.friend_requests for select
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
create policy "read own friendships" on public.friendships for select
  using (a = (select auth.uid()) or b = (select auth.uid()));
create policy "read own in-person code" on public.in_person_codes for select
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.social_log, public.friend_requests, public.friendships, public.in_person_codes
  from anon, authenticated;

-- Rate limit: log the action, and refuse once the student has done it more than p_limit times in the last hour.
-- (The caller's error rolls the log row back, so only actions that go through are counted.)
create function public.social_rate(p_action text, p_limit int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  perform pg_advisory_xact_lock(hashtextextended('social:' || me::text, 0));
  insert into public.social_log (user_id, action) values (me, p_action);
  if (select count(*) from public.social_log
       where user_id = me and action = p_action and at > now() - interval '1 hour') > p_limit then
    raise exception 'rate_limited';
  end if;
end $$;

-- Makes two students friends and clears any pending requests either way between them.
create function public.make_friends(p_x uuid, p_y uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.friendships (a, b) values (least(p_x, p_y), greatest(p_x, p_y)) on conflict do nothing;
  delete from public.friend_requests
   where (from_id = p_x and to_id = p_y) or (from_id = p_y and to_id = p_x);
end $$;

-- Send a request using the other student's friend code.
create function public.send_friend_request(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  other uuid;
begin
  if me is null then raise exception 'not_found'; end if;
  perform public.social_rate('friend_request', 20);
  select id into other from public.profiles where friend_code = upper(btrim(p_code));
  if other is null then raise exception 'not_found'; end if;
  if other = me then raise exception 'self'; end if;
  if exists (select 1 from public.friendships where a = least(me, other) and b = greatest(me, other)) then
    raise exception 'already_friends';
  end if;
  -- They already asked us: friends at once.
  if exists (select 1 from public.friend_requests where from_id = other and to_id = me) then
    perform public.make_friends(me, other);
    return;
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, other) on conflict do nothing;
end $$;

-- Accept or decline a request someone sent to the caller.
create function public.respond_friend_request(p_from uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  delete from public.friend_requests where from_id = p_from and to_id = me;
  if not found then raise exception 'not_found'; end if;
  if p_accept then perform public.make_friends(me, p_from); end if;
end $$;

-- Unfriend, and drop any pending requests between the two.
create function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  delete from public.friendships where a = least(me, p_other) and b = greatest(me, p_other);
  delete from public.friend_requests
   where (from_id = me and to_id = p_other) or (from_id = p_other and to_id = me);
end $$;

-- Add in person: a 6-digit code that works for 5 minutes. A new one replaces the old.
create function public.start_in_person() returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c text;
  exp timestamptz := now() + interval '5 minutes';
begin
  if me is null then raise exception 'not_found'; end if;
  perform public.social_rate('in_person_start', 30);
  delete from public.in_person_codes ip where ip.user_id = me or ip.expires_at <= now();
  loop
    c := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.in_person_codes ip where ip.code = c);
  end loop;
  insert into public.in_person_codes (code, user_id, expires_at) values (c, me, exp);
  return query select c, exp;
end $$;

-- Enter someone's in-person code: friends at once, pending requests cleared, code used up.
create function public.redeem_in_person(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  owner uuid;
begin
  if me is null then raise exception 'expired'; end if;
  perform public.social_rate('in_person_redeem', 30);
  delete from public.in_person_codes ip
   where ip.code = btrim(p_code) and ip.expires_at > now()
   returning ip.user_id into owner;
  if owner is null then raise exception 'expired'; end if;
  if owner = me then raise exception 'self'; end if;
  perform public.make_friends(me, owner);
end $$;

-- Names and colours only. No XP here, and a student hidden from boards still appears.
create function public.my_friends() returns table (user_id uuid, display_name text, avatar_color text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_color
    from public.friendships f
    join public.profiles p on p.id = case when f.a = (select auth.uid()) then f.b else f.a end
   where f.a = (select auth.uid()) or f.b = (select auth.uid())
   order by p.display_name nulls last, p.id
$$;

create function public.my_friend_requests()
returns table (from_id uuid, display_name text, avatar_color text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.from_id, p.display_name, p.avatar_color, r.created_at
    from public.friend_requests r
    join public.profiles p on p.id = r.from_id
   where r.to_id = (select auth.uid())
   order by r.created_at desc
$$;

-- Only signed-in students call these. The helpers stay internal.
revoke execute on function
  public.new_friend_code(), public.social_rate(text, int), public.make_friends(uuid, uuid),
  public.send_friend_request(text), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.start_in_person(), public.redeem_in_person(text), public.my_friends(), public.my_friend_requests()
  from public, anon, authenticated;
grant execute on function
  public.send_friend_request(text), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.start_in_person(), public.redeem_in_person(text), public.my_friends(), public.my_friend_requests()
  to authenticated;
