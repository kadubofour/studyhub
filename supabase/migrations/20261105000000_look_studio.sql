-- Ink is the default look (docs/superpowers/specs/2026-11-01-ink-look-design.md); Studio, Classic, Paper, Vivid and Playful stay as choices in Settings.
-- Students who already have an account keep the look they have.
alter table public.profiles drop constraint profiles_look_check;
alter table public.profiles add constraint profiles_look_check check (look in ('ink', 'studio', 'classic', 'paper', 'vivid', 'playful'));
alter table public.profiles alter column look set default 'ink';
