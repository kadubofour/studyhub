-- The look the student chose (see lib/appearance.ts): Classic is today's app, Paper is the warm version.
alter table public.profiles
  add column look text not null default 'classic'
    check (look in ('classic','paper'));
