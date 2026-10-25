-- Friend links: whoever opens /add/<code> sees the name and avatar of the code's owner before sending a request.
-- Nothing else is shown (no id, no code). Each look is logged, and past 30 an hour nothing comes back, so a code
-- cannot be scanned for owners.
create function public.friend_code_preview(p_code text) returns table (display_name text, avatar_color text)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return; end if;
  if not public.social_attempt('friend_preview', 30) then return; end if;
  return query
    select coalesce(nullif(btrim(p.display_name), ''), 'Student'), p.avatar_color
      from public.profiles p
     where p.friend_code = upper(btrim(p_code));
end $$;

revoke execute on function public.friend_code_preview(text) from public, anon, authenticated;
grant execute on function public.friend_code_preview(text) to authenticated;
