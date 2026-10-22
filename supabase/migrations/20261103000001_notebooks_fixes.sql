-- Notebooks, fixes: moving a note between notebooks (or its notebook being deleted) is not an edit, and search matches a backslash literally again.

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'course_id' - 'notebook_id' - 'updated_at') = (to_jsonb(old) - 'course_id' - 'notebook_id' - 'updated_at') then return new; end if;
  new.updated_at = now();
  return new;
end $$;

create or replace function public.search_notes(p_q text)
returns table (id uuid, course_id uuid, title text, updated_at timestamptz, notebook_id uuid)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select n.id, n.course_id, n.title, n.updated_at, n.notebook_id
    from public.notes n, q
   where n.title ilike q.pat or n.content_md ilike q.pat
   order by n.updated_at desc
$$;
