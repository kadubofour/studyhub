-- Two more looks (lib/appearance.ts): Vivid and Playful
alter table public.profiles drop constraint profiles_look_check;
alter table public.profiles add constraint profiles_look_check check (look in ('classic', 'paper', 'vivid', 'playful'));
