-- friend_code_preview now says why it has no name: 'ok', 'not_found' or 'rate_limited' (name and avatar are null
-- unless ok), so a busy lookup is not mistaken for a dead link.
drop function public.friend_code_preview(text);
create function public.friend_code_preview(p_code text) returns table (status text, display_name text, avatar_color text)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return query select 'not_found', null::text, null::text; return; end if;
  if not public.social_attempt('friend_preview', 30) then return query select 'rate_limited', null::text, null::text; return; end if;
  return query
    select 'ok', coalesce(nullif(btrim(p.display_name), ''), 'Student'), p.avatar_color
      from public.profiles p
     where p.friend_code = upper(btrim(p_code));
  if not found then return query select 'not_found', null::text, null::text; end if;
end $$;

revoke execute on function public.friend_code_preview(text) from public, anon, authenticated;
grant execute on function public.friend_code_preview(text) to authenticated;
