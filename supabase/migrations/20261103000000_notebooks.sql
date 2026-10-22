-- Notebooks: named groups of notes. A note is in at most one; deleting a notebook keeps its notes (they become unfiled).
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index notebooks_user on public.notebooks (user_id, created_at);
alter table public.notebooks enable row level security;
create policy "own rows" on public.notebooks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.owns_notebook(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notebooks b where b.id = nid and b.user_id = auth.uid())
$$;

alter table public.notes add column notebook_id uuid references public.notebooks on delete set null;
create index notes_notebook on public.notes (notebook_id);

-- A note can only go in the student's own notebook
drop policy "own rows" on public.notes;
create policy "own rows" on public.notes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and (notebook_id is null or public.owns_notebook(notebook_id)));

-- Search also says which notebook each note is in
drop function public.search_notes(text);
create function public.search_notes(p_q text)
returns table (id uuid, course_id uuid, title text, updated_at timestamptz, notebook_id uuid)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(p_q, '\', '\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select n.id, n.course_id, n.title, n.updated_at, n.notebook_id
    from public.notes n, q
   where n.title ilike q.pat or n.content_md ilike q.pat
   order by n.updated_at desc
$$;
