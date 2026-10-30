-- Uploaded material: the original PDF, Word, PowerPoint or text file a note was made from, kept in the Library.
-- One row per file; the file itself is in the private "materials" bucket, "<user id>/<material id>-<name>".
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  note_id uuid references public.notes on delete set null,
  name text not null check (length(name) between 1 and 200),
  mime text not null check (mime in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/markdown')),
  bytes bigint not null check (bytes between 0 and 26214400),
  path text not null unique,
  created_at timestamptz not null default now(),
  -- the file is in the student's own folder
  check (split_part(path, '/', 1) = user_id::text)
);
create index materials_user on public.materials (user_id, created_at desc);
create index materials_note on public.materials (note_id);
alter table public.materials enable row level security;
create policy "own rows" on public.materials for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and (note_id is null or public.owns_note(note_id)));

-- The files: private, at most 25 MB each (a PDF the importer reads is at most 24 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/markdown']);

-- The signed-in student's kept files, in bytes
create function public.material_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
    from storage.objects o
   where o.bucket_id = 'materials' and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;
revoke execute on function public.material_bytes() from public, anon;
grant execute on function public.material_bytes() to authenticated;

-- New files only while the student is under 500 MB (one file, at most 25 MB, may go over it)
create policy "materials: upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.material_bytes() < 524288000
  );
create policy "materials: read own" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materials: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
