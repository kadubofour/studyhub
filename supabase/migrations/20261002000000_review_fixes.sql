-- Fixes from the Phase 1 final review --------------------------------------

-- A focus session is identified by who started it and when; logging it again
-- (a second /focus tab, or a Retry after an ambiguous failure) must not duplicate it.
-- Remove duplicates already logged (keep the first row) so the index can be built.
delete from public.focus_sessions f
 using public.focus_sessions g
 where f.user_id = g.user_id and f.started_at = g.started_at and f.ctid > g.ctid;
create unique index focus_user_start_uniq on public.focus_sessions (user_id, started_at);

-- Rating a card = reschedule the card + record the review, in one transaction.
-- The review is inserted first so an invalid rating fails before the card changes.
create function public.rate_card(
  p_card_id uuid, p_due_at timestamptz, p_interval_days int, p_ease real, p_reps int, p_lapses int,
  p_rating int, p_reviewed_at timestamptz, p_prev_interval_days int
) returns setof public.cards
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.reviews (card_id, rating, reviewed_at, prev_interval_days, new_interval_days)
  values (p_card_id, p_rating, p_reviewed_at, p_prev_interval_days, p_interval_days);
  return query
    update public.cards
       set due_at = p_due_at, interval_days = p_interval_days, ease = p_ease, reps = p_reps, lapses = p_lapses
     where id = p_card_id
    returning *;
end $$;

-- Time zones must be real IANA names, or every date on the user's pages would fail.
create function public.is_valid_timezone(tz text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz)
$$;

create function public.validate_profile_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'invalid time zone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;

create trigger profiles_validate_timezone before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- Signup metadata may carry a zone Postgres doesn't know; fall back to UTC instead of failing signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tz text := new.raw_user_meta_data->>'timezone';
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    case when tz is not null and public.is_valid_timezone(tz) then tz else 'UTC' end
  );
  return new;
end $$;

-- Note search over titles and content. LIKE wildcards in the query are escaped so
-- "50%" or "snake_case" match literally.
create function public.search_notes(p_q text)
returns table (id uuid, course_id uuid, title text, updated_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select n.id, n.course_id, n.title, n.updated_at
    from public.notes n, q
   where n.title ilike q.pat or n.content_md ilike q.pat
   order by n.updated_at desc
$$;
