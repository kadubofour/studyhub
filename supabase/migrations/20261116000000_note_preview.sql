-- The start of each note's text, for the line under its title in the notes list (a phone shows it, as notes apps do).
-- Kept by the database itself, so the list never reads every note's whole text.
alter table public.notes add column preview text generated always as (left(content_md, 400)) stored;

-- Moving a note is still not an edit. The preview only follows the text, and before an update it is not worked out yet
-- (it reads as empty), so it is left out of the comparison like the other columns a move changes.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'course_id' - 'notebook_id' - 'updated_at' - 'preview') = (to_jsonb(old) - 'course_id' - 'notebook_id' - 'updated_at' - 'preview') then return new; end if;
  new.updated_at = now();
  return new;
end $$;
