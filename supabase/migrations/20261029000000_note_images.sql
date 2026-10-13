-- Pictures in notes: a private bucket, one folder per student, "<user id>/<uuid>.<ext>". PNG, JPEG or WebP, 5 MB at most.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);
create policy "note-images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "note-images: read own" on storage.objects for select to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "note-images: update own" on storage.objects for update to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "note-images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
