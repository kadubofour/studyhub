-- Drawings travel with a shared note: shared_item shows a note's ink (and each notebook note's), and copy_shared copies it.
-- Everything else about the two functions is as in 20261113000000_shares.sql.

create or replace function public.shared_item(p_token text) returns jsonb
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
    select jsonb_build_object('title', n.title, 'content_md', n.content_md, 'ink', n.ink)
      into item from public.notes n where n.id = s.item_id;
  elsif s.kind = 'notebook' then
    select jsonb_build_object('name', b.name, 'notes', coalesce((
             select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'content_md', n.content_md, 'ink', n.ink)
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

create or replace function public.copy_shared(p_token text) returns table (kind text, id uuid)
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
    insert into public.notes (user_id, title, content_md, ink)
      select me, n.title, n.content_md, n.ink from public.notes n where n.id = s.item
      returning notes.id into new_id;
    if new_id is null then raise exception 'link_off'; end if;
  else
    insert into public.notebooks (user_id, name) select me, b.name from public.notebooks b where b.id = s.item
      returning notebooks.id into new_id;
    if new_id is null then raise exception 'link_off'; end if;
    insert into public.notes (user_id, notebook_id, title, content_md, ink, updated_at)
      select me, new_id, n.title, n.content_md, n.ink, n.updated_at from public.notes n
       where n.notebook_id = s.item order by n.updated_at, n.id;
  end if;
  return query select s.k, new_id;
end $$;
revoke execute on function public.copy_shared(text) from public, anon;
grant execute on function public.copy_shared(text) to authenticated;
