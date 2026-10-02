-- Private, short-lived storage for PDFs waiting to be converted by the AI importer.
-- Files live under "<user id>/…"; each student can only touch their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 33554432, array['application/pdf']);

create policy "imports: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imports: read own" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imports: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
