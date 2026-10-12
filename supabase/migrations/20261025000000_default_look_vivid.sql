-- New students start on the Vivid look. Students who already have an account keep the look they have.
alter table public.profiles alter column look set default 'vivid';
