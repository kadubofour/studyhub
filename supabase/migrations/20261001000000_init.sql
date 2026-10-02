-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  daily_goal_minutes int not null default 120 check (daily_goal_minutes between 1 and 1440),
  focus_minutes int not null default 25 check (focus_minutes between 1 and 180),
  short_break_minutes int not null default 5 check (short_break_minutes between 1 and 60),
  long_break_minutes int not null default 15 check (long_break_minutes between 1 and 120),
  long_break_every int not null default 4 check (long_break_every between 1 and 12),
  default_editor_mode text not null default 'rich' check (default_editor_mode in ('rich','markdown')),
  theme text not null default 'system' check (theme in ('light','dark','system')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Content tables ---------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null check (length(title) between 1 and 300),
  type text not null default 'other' check (type in ('assignment','exam','reading','other')),
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_user_due on public.tasks (user_id, due_at);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  location text,
  kind text not null default 'lecture' check (kind in ('lecture','lab','tutorial','seminar','other')),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null default 'Untitled',
  content_md text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid not null references public.decks on delete cascade,
  front text not null,
  back text not null,
  due_at timestamptz not null default now(),
  interval_days int not null default 0,
  ease real not null default 2.5,
  reps int not null default 0,
  lapses int not null default 0,
  created_at timestamptz not null default now()
);
create index cards_user_due on public.cards (user_id, due_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  rating int not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  prev_interval_days int not null,
  new_interval_days int not null,
  created_at timestamptz not null default now()
);
create index reviews_user_time on public.reviews (user_id, reviewed_at);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes int not null check (minutes between 0 and 600),
  completed boolean not null,
  created_at timestamptz not null default now()
);
create index focus_user_time on public.focus_sessions (user_id, started_at);

-- Ownership helpers (security definer so they can read across RLS) -------
create function public.owns_course(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select cid is null or exists (select 1 from public.courses c where c.id = cid and c.user_id = auth.uid())
$$;
create function public.owns_deck(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.decks d where d.id = did and d.user_id = auth.uid())
$$;
create function public.owns_card(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cards c where c.id = cid and c.user_id = auth.uid())
$$;

-- RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.courses enable row level security;
create policy "own rows" on public.courses for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.tasks enable row level security;
create policy "own rows" on public.tasks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.classes enable row level security;
create policy "own rows" on public.classes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.notes enable row level security;
create policy "own rows" on public.notes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.decks enable row level security;
create policy "own rows" on public.decks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.cards enable row level security;
create policy "own rows" on public.cards for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_deck(deck_id));

alter table public.reviews enable row level security;
create policy "own rows" on public.reviews for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_card(card_id));

alter table public.focus_sessions enable row level security;
create policy "own rows" on public.focus_sessions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
