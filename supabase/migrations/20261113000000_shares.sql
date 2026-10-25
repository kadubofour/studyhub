-- Share links: a deck, a note, a notebook or a progress card can be shared with anyone who has the link.
-- The table is private; the only way anyone else reads anything is shared_item(token), which returns just the shared content
-- and the owner's name and look (never the owner's id or email). Every write goes through the functions below.

create table public.shares (
  token text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('deck', 'note', 'notebook', 'progress')),
  item_id uuid,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((kind = 'progress') = (item_id is null and snapshot is not null))
);
create index shares_owner on public.shares (owner_id, created_at);
-- One live link per deck, note or notebook (progress cards are snapshots, one per card)
create unique index shares_one_active on public.shares (owner_id, kind, item_id)
  where revoked_at is null and kind <> 'progress';

alter table public.shares enable row level security;
create policy "owner reads own shares" on public.shares for select
  using (owner_id = (select auth.uid()));
revoke all on public.shares from anon, authenticated;
grant select on public.shares to authenticated;

-- A link token is 244 random bits as 64 hex characters (URL-safe; gen_random_uuid is built in, no extension needed).
create function public.gen_share_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;
revoke execute on function public.gen_share_token() from public, anon, authenticated;

-- Checks the kind is one that can be shared as an item, and that the signed-in student owns it.
create function public.check_share_owner(p_kind text, p_item uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ok boolean;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_kind is null or p_kind not in ('deck', 'note', 'notebook') then raise exception 'invalid_kind'; end if;
  ok := case p_kind
    when 'deck' then exists (select 1 from public.decks where id = p_item and user_id = me)
    when 'note' then exists (select 1 from public.notes where id = p_item and user_id = me)
    else exists (select 1 from public.notebooks where id = p_item and user_id = me)
  end;
  if not coalesce(ok, false) then raise exception 'not_owner'; end if;
  return me;
end $$;
revoke execute on function public.check_share_owner(text, uuid) from public, anon, authenticated;

-- Deleting a deck, note or notebook turns its link off.
create function public.revoke_item_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.shares set revoked_at = now()
   where kind = tg_argv[0] and item_id = old.id and revoked_at is null;
  return old;
end $$;
revoke execute on function public.revoke_item_shares() from public, anon, authenticated;
create trigger decks_revoke_shares after delete on public.decks
  for each row execute function public.revoke_item_shares('deck');
create trigger notes_revoke_shares after delete on public.notes
  for each row execute function public.revoke_item_shares('note');
create trigger notebooks_revoke_shares after delete on public.notebooks
  for each row execute function public.revoke_item_shares('notebook');

-- Returns the live link for the item, or makes one (60 new links an hour; returning the existing one costs nothing).
create function public.share_item(p_kind text, p_item uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.check_share_owner(p_kind, p_item);
  t text;
begin
  perform pg_advisory_xact_lock(hashtextextended('share:' || me::text || p_kind || p_item::text, 0));
  select s.token into t from public.shares s
   where s.owner_id = me and s.kind = p_kind and s.item_id = p_item and s.revoked_at is null;
  if t is not null then return t; end if;
  perform public.social_rate('share_item', 60);
  t := public.gen_share_token();
  insert into public.shares (token, owner_id, kind, item_id) values (t, me, p_kind, p_item);
  return t;
end $$;
revoke execute on function public.share_item(text, uuid) from public, anon;
grant execute on function public.share_item(text, uuid) to authenticated;

-- Turns the old link off and makes a new one.
create function public.reshare_item(p_kind text, p_item uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.check_share_owner(p_kind, p_item);
  t text;
begin
  perform pg_advisory_xact_lock(hashtextextended('share:' || me::text || p_kind || p_item::text, 0));
  perform public.social_rate('share_item', 60);
  update public.shares set revoked_at = now()
   where owner_id = me and kind = p_kind and item_id = p_item and revoked_at is null;
  t := public.gen_share_token();
  insert into public.shares (token, owner_id, kind, item_id) values (t, me, p_kind, p_item);
  return t;
end $$;
revoke execute on function public.reshare_item(text, uuid) from public, anon;
grant execute on function public.reshare_item(text, uuid) to authenticated;

create function public.unshare_item(p_kind text, p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.check_share_owner(p_kind, p_item);
begin
  update public.shares set revoked_at = now()
   where owner_id = me and kind = p_kind and item_id = p_item and revoked_at is null;
end $$;
revoke execute on function public.unshare_item(text, uuid) from public, anon;
grant execute on function public.unshare_item(text, uuid) to authenticated;

-- A progress card: a snapshot of the numbers now. Each call makes a new card (and a new link).
-- level follows levelInfo: level n starts at 50 * (n - 1)^2 XP.
create function public.share_progress() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  tz text;
  monday date;
  x record;
  focus int;
  prof record;
  t text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  perform public.social_rate('share_item', 60);
  select p.timezone, p.display_name, p.avatar_color into prof from public.profiles p where p.id = me;
  tz := coalesce(prof.timezone, 'UTC');
  monday := date_trunc('week', ((now() at time zone tz)::date)::timestamp)::date;
  select * into x from public.xp_totals(me);
  select coalesce(sum(f.minutes), 0)::int into focus from public.focus_sessions f
   where f.user_id = me and public.on_time(f.started_at, f.received_at)
     and (f.started_at at time zone tz)::date >= monday;
  t := public.gen_share_token();
  insert into public.shares (token, owner_id, kind, snapshot) values (t, me, 'progress', jsonb_build_object(
    'level', floor(sqrt(coalesce(x.total, 0)::float8 / 50))::int + 1,
    'total_xp', coalesce(x.total, 0),
    'week_xp', coalesce(x.week, 0),
    'streak', coalesce(x.streak, 0),
    'week_focus_minutes', focus,
    'display_name', coalesce(nullif(btrim(prof.display_name), ''), 'Student'),
    'avatar_color', coalesce(prof.avatar_color, '#3B5BDB')));
  return t;
end $$;
revoke execute on function public.share_progress() from public, anon;
grant execute on function public.share_progress() to authenticated;

-- What a link shows: null for a missing or turned-off link. Only the content and the owner's name and look.
create function public.shared_item(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s record;
  prof record;
  item jsonb;
begin
  select sh.kind, sh.owner_id, sh.item_id, sh.snapshot into s from public.shares sh
   where sh.token = p_token and sh.revoked_at is null;
  if not found then return null; end if;
  if s.kind = 'deck' then
    select jsonb_build_object('name', d.name, 'cards', coalesce((
             select jsonb_agg(jsonb_build_object('front', c.front, 'back', c.back) order by c.created_at, c.id)
               from public.cards c where c.deck_id = d.id), '[]'::jsonb))
      into item from public.decks d where d.id = s.item_id;
  elsif s.kind = 'note' then
    select jsonb_build_object('title', n.title, 'content_md', n.content_md)
      into item from public.notes n where n.id = s.item_id;
  elsif s.kind = 'notebook' then
    select jsonb_build_object('name', b.name, 'notes', coalesce((
             select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'content_md', n.content_md)
                              order by n.updated_at desc, n.id)
               from public.notes n where n.notebook_id = b.id and n.user_id = b.user_id), '[]'::jsonb))
      into item from public.notebooks b where b.id = s.item_id;
  else
    item := s.snapshot;
  end if;
  if item is null then return null; end if;
  select p.display_name, p.avatar_color, p.look, p.accent into prof from public.profiles p where p.id = s.owner_id;
  return jsonb_build_object(
    'kind', s.kind,
    'owner', jsonb_build_object(
      'display_name', coalesce(nullif(btrim(prof.display_name), ''), 'Student'),
      'avatar_color', prof.avatar_color, 'look', prof.look, 'accent', prof.accent),
    'item', item);
end $$;
revoke execute on function public.shared_item(text) from public;
grant execute on function public.shared_item(text) to anon, authenticated;

-- Copies what a link shows into the signed-in student's own library: no course, a deck's cards start fresh.
create function public.copy_shared(p_token text) returns table (kind text, id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s record;
  new_id uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select sh.kind as k, sh.item_id as item into s from public.shares sh
   where sh.token = p_token and sh.revoked_at is null;
  if not found then raise exception 'link_off'; end if;
  if s.k = 'progress' then raise exception 'not_copyable'; end if;
  perform public.social_rate('copy_shared', 30);
  if s.k = 'deck' then
    insert into public.decks (user_id, name) select me, d.name from public.decks d where d.id = s.item
      returning decks.id into new_id;
    if new_id is null then raise exception 'link_off'; end if;
    insert into public.cards (user_id, deck_id, front, back)
      select me, new_id, c.front, c.back from public.cards c where c.deck_id = s.item
       order by c.created_at, c.id;
  elsif s.k = 'note' then
    insert into public.notes (user_id, title, content_md)
      select me, n.title, n.content_md from public.notes n where n.id = s.item
      returning notes.id into new_id;
    if new_id is null then raise exception 'link_off'; end if;
  else
    insert into public.notebooks (user_id, name) select me, b.name from public.notebooks b where b.id = s.item
      returning notebooks.id into new_id;
    if new_id is null then raise exception 'link_off'; end if;
    insert into public.notes (user_id, notebook_id, title, content_md, updated_at)
      select me, new_id, n.title, n.content_md, n.updated_at from public.notes n
       where n.notebook_id = s.item order by n.updated_at, n.id;
  end if;
  return query select s.k, new_id;
end $$;
revoke execute on function public.copy_shared(text) from public, anon;
grant execute on function public.copy_shared(text) to authenticated;

-- The picture files a shared note (or a shared notebook's notes) uses, for the server to fetch with its own key.
-- Only plain file names (no folders, no ..), each once; nothing for a turned-off link.
create function public.shared_note_files(p_token text) returns table (owner_id uuid, file text)
language sql stable security definer set search_path = '' as $$
  select distinct sh.owner_id, m[1]
    from public.shares sh
    join public.notes n on n.user_id = sh.owner_id
     and ((sh.kind = 'note' and n.id = sh.item_id) or (sh.kind = 'notebook' and n.notebook_id = sh.item_id)),
    lateral regexp_matches(n.content_md, '!\[[^\]]*\]\(studyhub-image:([^)\s]*)\)', 'g') as m
   where sh.token = p_token and sh.revoked_at is null
     and m[1] ~ '^[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?$'
$$;
revoke execute on function public.shared_note_files(text) from public, anon, authenticated;
