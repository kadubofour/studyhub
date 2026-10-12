-- Moving a note or a tutor chat to another course is not an edit: it keeps its "edited" time, so it does not jump to the top of every list
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'course_id' - 'updated_at') = (to_jsonb(old) - 'course_id' - 'updated_at') then return new; end if;
  new.updated_at = now();
  return new;
end $$;
