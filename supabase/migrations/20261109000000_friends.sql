-- Friends: a code to add each other by, friend requests, a weekly XP board among friends, and sharing notes and decks.
-- Students never read each other's rows directly. Everything about another student goes through the functions below,
-- which check the friendship first and return only a name, an avatar colour, a weekly XP total or what was shared.

-- 1) Each student's code, for adding them as a friend (8 letters and digits, without look-alikes such as O and 0)
create function public.new_friend_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop code := code || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = code);
  end loop;
  return code;
end $$;
alter table public.profiles add column friend_code text;
update public.profiles set friend_code = public.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set default public.new_friend_code();
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);

-- 2) Friendships: a request from one student to another, then accepted. One row per pair, whoever asked.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users on delete cascade,
  addressee uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on public.friendships (addressee);
alter table public.friendships enable row level security;
-- Either side sees the row and can delete it (decline, cancel or remove). Asking and accepting go through the functions below.
create policy "either side reads" on public.friendships for select using ((select auth.uid()) in (requester, addressee));
create policy "either side deletes" on public.friendships for delete using ((select auth.uid()) in (requester, addressee));

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
    and least(f.requester, f.addressee) = least(a, b) and greatest(f.requester, f.addressee) = greatest(a, b))
$$;

-- Ask the student with this code to be friends. If they had already asked you, you are friends at once.
create function public.send_friend_request(p_code text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  them uuid;
  f public.friendships;
begin
  if me is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select p.id into them from public.profiles p where p.friend_code = upper(btrim(p_code));
  if them is null then raise exception 'No one has that code' using errcode = 'P0002'; end if;
  if them = me then raise exception 'That is your own code' using errcode = '22023'; end if;
  select * into f from public.friendships x
   where least(x.requester, x.addressee) = least(me, them) and greatest(x.requester, x.addressee) = greatest(me, them);
  if found then
    if f.status = 'accepted' then return 'already_friends'; end if;
    if f.addressee = me then
      update public.friendships set status = 'accepted', accepted_at = now() where id = f.id;
      return 'accepted';
    end if;
    return 'already_asked';
  end if;
  if (select count(*) from public.friendships x where me in (x.requester, x.addressee)) >= 200 then
    raise exception 'Too many friends and requests' using errcode = '54000';
  end if;
  insert into public.friendships (requester, addressee) values (me, them);
  return 'sent';
end $$;

create function public.accept_friend_request(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.friendships set status = 'accepted', accepted_at = now()
   where id = p_id and addressee = auth.uid() and status = 'pending';
  if not found then raise exception 'No such request' using errcode = 'P0002'; end if;
end $$;

-- Your friends and requests, each with the other student's name and avatar colour (and nothing else about them)
create function public.list_friends() returns table (id uuid, user_id uuid, display_name text, avatar_color text, status text, incoming boolean, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id, o.id, coalesce(nullif(btrim(o.display_name), ''), 'A student'), o.avatar_color, f.status, f.addressee = auth.uid(), coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles o on o.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.status, coalesce(nullif(btrim(o.display_name), ''), 'A student')
$$;

-- 3) Weekly XP: what one student earned since p_from (a local day in p_tz), by the same rules and daily caps as
--    lib/xp/rules.ts (tests/db/friends.test.ts keeps the two in step). Not callable directly: only friends_week_xp uses it.
create function public.week_xp(p_user uuid, p_tz text, p_from date) returns int
language sql stable security definer set search_path = '' as $$
  with since as (select (p_from::timestamp at time zone p_tz) as t),
  ev as (
    select (reviewed_at at time zone p_tz)::date as d, 1 as r, 0 as q, 0 as f, 0 as t, 0 as p, 0 as m, 0 as l, 0 as g
      from public.reviews, since where user_id = p_user and reviewed_at >= since.t
    union all
    select (finished_at at time zone p_tz)::date, 0, 1, 0, 0, 0, 0, 0, 0
      from public.quiz_attempts, since where user_id = p_user and finished_at >= since.t
    union all
    select (started_at at time zone p_tz)::date, 0, 0, minutes, 0, 0, 0, 0, 0
      from public.focus_sessions, since where user_id = p_user and started_at >= since.t
    union all
    select (done_at at time zone p_tz)::date, 0, 0, 0, 1, 0, 0, 0, 0
      from public.tasks, since where user_id = p_user and done_at >= since.t
    union all
    select ((s ->> 'done_at')::timestamptz at time zone p_tz)::date, 0, 0, 0, 0, 1, 0, 0, 0
      from public.study_plan_days pd, jsonb_array_elements(pd.sessions) s, since
      where pd.user_id = p_user and s ->> 'done_at' is not null and (s ->> 'done_at')::timestamptz >= since.t
    union all
    select (created_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 1, 0, 0
      from public.tutor_messages, since where user_id = p_user and role = 'user' and created_at >= since.t
    union all
    select (recorded_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 0, 1, 0
      from public.lectures, since where user_id = p_user and recorded_at >= since.t
    union all
    select (created_at at time zone p_tz)::date, 0, 0, 0, 0, 0, 0, 0, 1
      from public.game_plays, since where user_id = p_user and created_at >= since.t
  ),
  days as (select sum(r) r, sum(q) q, sum(f) f, sum(t) t, sum(p) p, sum(m) m, sum(l) l, sum(g) g from ev group by d)
  select coalesce(sum(
      least(r, 50) * 1 + least(q, 5) * 10 + least(f / 5, 24) * 1 + least(t, 10) * 5 + least(p, 8) * 8
    + least(m, 10) * 2 + least(l, 2) * 15 + least(g, 3) * 8
    + case when r >= 10 and f >= 25 and q >= 1 then 20 else 0 end), 0)::int
  from days
$$;
revoke execute on function public.week_xp(uuid, text, date) from public, anon, authenticated;

-- This week's XP (from Monday in the viewer's time zone) for the viewer and each accepted friend, highest first
create function public.friends_week_xp(p_tz text) returns table (user_id uuid, display_name text, avatar_color text, xp int, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  monday date;
begin
  if me is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  monday := date_trunc('week', now() at time zone p_tz)::date; -- an unknown time zone fails here
  return query
  with people as (
    select me as id
    union
    select case when f.requester = me then f.addressee else f.requester end
      from public.friendships f where f.status = 'accepted' and me in (f.requester, f.addressee)
  )
  select pr.id, coalesce(nullif(btrim(pr.display_name), ''), 'A student'), pr.avatar_color, public.week_xp(pr.id, p_tz, monday), pr.id = me
  from people join public.profiles pr on pr.id = people.id
  order by 4 desc, 2;
end $$;

-- 4) Sharing a note or a deck with a friend. The owner shares; the friend can read it (through the functions below) and
--    save a copy. Either of them can take it off their list.
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('note', 'deck')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (owner, recipient, kind, item_id),
  check (owner <> recipient)
);
create index shares_recipient on public.shares (recipient, created_at desc);
create index shares_item on public.shares (kind, item_id);
alter table public.shares enable row level security;

create function public.owns_item(p_kind text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'note' then exists (select 1 from public.notes n where n.id = p_id and n.user_id = auth.uid())
    when 'deck' then exists (select 1 from public.decks d where d.id = p_id and d.user_id = auth.uid())
    else false end
$$;
create policy "either side reads" on public.shares for select using ((select auth.uid()) in (owner, recipient));
create policy "either side deletes" on public.shares for delete using ((select auth.uid()) in (owner, recipient));
create policy "share your own with a friend" on public.shares for insert
  with check (owner = (select auth.uid()) and public.are_friends(owner, recipient) and public.owns_item(kind, item_id));

-- A share ends with what was shared, and with the friendship
create function public.end_item_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.shares where kind = tg_argv[0] and item_id = old.id;
  return old;
end $$;
create trigger notes_end_shares after delete on public.notes for each row execute function public.end_item_shares('note');
create trigger decks_end_shares after delete on public.decks for each row execute function public.end_item_shares('deck');
create function public.end_friend_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.shares s where (s.owner = old.requester and s.recipient = old.addressee) or (s.owner = old.addressee and s.recipient = old.requester);
  return old;
end $$;
create trigger friendships_end_shares after delete on public.friendships for each row execute function public.end_friend_shares();

-- What friends shared with you, and what you shared, with titles and names
create function public.shared_with_me() returns table (id uuid, kind text, item_id uuid, title text, owner_id uuid, owner_name text, owner_color text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.kind, s.item_id, coalesce(n.title, d.name), s.owner, coalesce(nullif(btrim(p.display_name), ''), 'A student'), p.avatar_color, s.created_at
  from public.shares s
  join public.profiles p on p.id = s.owner
  left join public.notes n on s.kind = 'note' and n.id = s.item_id
  left join public.decks d on s.kind = 'deck' and d.id = s.item_id
  where s.recipient = auth.uid() and public.are_friends(s.owner, s.recipient) and coalesce(n.id, d.id) is not null
  order by s.created_at desc
$$;
create function public.shared_by_me() returns table (id uuid, kind text, item_id uuid, title text, recipient_id uuid, recipient_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.kind, s.item_id, coalesce(n.title, d.name), s.recipient, coalesce(nullif(btrim(p.display_name), ''), 'A student'), s.created_at
  from public.shares s
  join public.profiles p on p.id = s.recipient
  left join public.notes n on s.kind = 'note' and n.id = s.item_id
  left join public.decks d on s.kind = 'deck' and d.id = s.item_id
  where s.owner = auth.uid() and coalesce(n.id, d.id) is not null
  order by s.created_at desc
$$;

-- One shared note or deck, for the friend it was shared with
create function public.shared_note(p_share uuid) returns table (title text, content_md text, ink jsonb, owner_id uuid, owner_name text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.title, n.content_md, n.ink, n.user_id, coalesce(nullif(btrim(p.display_name), ''), 'A student'), n.updated_at
  from public.shares s join public.notes n on n.id = s.item_id join public.profiles p on p.id = n.user_id
  where s.id = p_share and s.kind = 'note' and s.recipient = auth.uid() and public.are_friends(s.owner, s.recipient)
$$;
create function public.shared_deck(p_share uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', d.name, 'owner_name', coalesce(nullif(btrim(p.display_name), ''), 'A student'),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('front', c.front, 'back', c.back) order by c.created_at, c.id)
                       from public.cards c where c.deck_id = d.id), '[]'::jsonb))
  from public.shares s join public.decks d on d.id = s.item_id join public.profiles p on p.id = d.user_id
  where s.id = p_share and s.kind = 'deck' and s.recipient = auth.uid() and public.are_friends(s.owner, s.recipient)
$$;

-- 5) The pictures in a note shared with you: only those the note uses, from the owner's folder, while you are friends
create function public.can_read_shared_image(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shares s join public.notes n on n.id = s.item_id
    where s.kind = 'note' and s.recipient = auth.uid() and n.user_id::text = split_part(p_name, '/', 1)
      and position(('studyhub-image:' || split_part(p_name, '/', 2)) in n.content_md) > 0
      and public.are_friends(s.owner, s.recipient))
$$;
create policy "note-images: read shared" on storage.objects for select to authenticated
  using (bucket_id = 'note-images' and public.can_read_shared_image(name));
