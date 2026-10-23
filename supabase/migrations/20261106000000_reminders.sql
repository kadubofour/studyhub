-- Reminders the student sets for themselves (docs/superpowers/specs/2026-10-30-my-reminders-design.md).
-- The day and time are in the student's own time zone, so a daily reminder keeps its local time when the clocks change.
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  day date not null,
  at time not null,
  repeat text not null default 'once' check (repeat in ('once', 'daily', 'weekdays', 'weekly')),
  created_at timestamptz not null default now()
);
create index reminders_user on public.reminders (user_id, day);
alter table public.reminders enable row level security;
create policy "own rows" on public.reminders for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
