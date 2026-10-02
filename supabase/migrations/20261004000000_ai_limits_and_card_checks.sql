-- Daily limit on AI imports (each one costs money on the app's API key) ---------------------
create table public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  imports int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- Students can see their own usage; only consume_ai_import (below) can change it
create policy "read own usage" on public.ai_usage for select using (user_id = (select auth.uid()));

-- Atomically uses one of today's 20 imports (UTC day). Returns false once the limit is reached.
-- The limit is fixed here, not a parameter, so a student can't call it with a bigger one.
create function public.consume_ai_import() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  used int;
begin
  if uid is null then return false; end if;
  insert into public.ai_usage (user_id, day, imports)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set imports = public.ai_usage.imports + 1
    where public.ai_usage.imports < 20
  returning imports into used;
  return used is not null;
end $$;
revoke execute on function public.consume_ai_import() from public, anon;
grant execute on function public.consume_ai_import() to authenticated;

-- Card scheduling values must be sane (also lets tests prove rate_card is all-or-nothing) ----
-- Bring any out-of-range rows back into range first, so the constraints can be added
update public.cards
   set reps = greatest(reps, 0), lapses = greatest(lapses, 0),
       interval_days = greatest(interval_days, 0), ease = case when ease > 0 then ease else 2.5 end
 where reps < 0 or lapses < 0 or interval_days < 0 or ease <= 0;
alter table public.cards
  add constraint cards_reps_nonneg check (reps >= 0),
  add constraint cards_lapses_nonneg check (lapses >= 0),
  add constraint cards_interval_nonneg check (interval_days >= 0),
  add constraint cards_ease_positive check (ease > 0);
