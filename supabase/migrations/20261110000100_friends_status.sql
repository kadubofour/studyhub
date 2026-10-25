-- Friends, part 2. Failed friend attempts must count toward the limit, and a raised error rolls its log row
-- back. So sending a request and entering an in-person code now return a status word instead of raising:
-- 'ok', 'not_found', 'expired', 'self', 'already_friends' or 'rate_limited'. Every attempt is logged and kept.

-- The internal code maker takes a new name; "new_friend_code" becomes the student's own button.
alter function public.new_friend_code() rename to gen_friend_code;

-- Logs an attempt and says whether it is within the limit for the last hour. It never raises.
create function public.social_attempt(p_action text, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  perform pg_advisory_xact_lock(hashtextextended('social:' || me::text, 0));
  insert into public.social_log (user_id, action) values (me, p_action);
  return (select count(*) from public.social_log
           where user_id = me and action = p_action and at > now() - interval '1 hour') <= p_limit;
end $$;

-- Only the system (or new_friend_code below) may change a friend code.
create or replace function public.keep_friend_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.friend_code_change', true), '') <> '1' then
    new.friend_code := old.friend_code;
  end if;
  return new;
end $$;

-- A student who shared their code too widely can get a new one; the old one stops working.
create function public.new_friend_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c text;
begin
  if me is null then raise exception 'not_found'; end if;
  perform public.social_rate('new_friend_code', 10);
  c := public.gen_friend_code();
  perform set_config('app.friend_code_change', '1', true);
  update public.profiles set friend_code = c where id = me;
  perform set_config('app.friend_code_change', '', true);
  return c;
end $$;

drop function public.send_friend_request(text);
create function public.send_friend_request(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  other uuid;
begin
  if me is null then return 'not_found'; end if;
  if not public.social_attempt('friend_request', 20) then return 'rate_limited'; end if;
  select id into other from public.profiles where friend_code = upper(btrim(p_code));
  if other is null then return 'not_found'; end if;
  if other = me then return 'self'; end if;
  if exists (select 1 from public.friendships where a = least(me, other) and b = greatest(me, other)) then
    return 'already_friends';
  end if;
  -- They already asked us: friends at once.
  if exists (select 1 from public.friend_requests where from_id = other and to_id = me) then
    perform public.make_friends(me, other);
    return 'ok';
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, other) on conflict do nothing;
  return 'ok';
end $$;

drop function public.redeem_in_person(text);
create function public.redeem_in_person(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  owner uuid;
begin
  if me is null then return 'expired'; end if;
  if not public.social_attempt('redeem_in_person', 10) then return 'rate_limited'; end if;
  select ip.user_id into owner from public.in_person_codes ip
   where ip.code = btrim(p_code) and ip.expires_at > now() for update;
  if owner is null then return 'expired'; end if;
  if owner = me then return 'self'; end if;
  delete from public.in_person_codes ip where ip.code = btrim(p_code);
  perform public.make_friends(me, owner);
  return 'ok';
end $$;

revoke execute on function
  public.gen_friend_code(), public.social_attempt(text, int), public.new_friend_code(),
  public.send_friend_request(text), public.redeem_in_person(text)
  from public, anon, authenticated;
grant execute on function
  public.new_friend_code(), public.send_friend_request(text), public.redeem_in_person(text)
  to authenticated;
