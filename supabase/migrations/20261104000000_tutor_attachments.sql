-- Files and photos added to tutor messages.
-- The question keeps a list of them: [{ kind: 'photo'|'pdf', name, path, pages } | { kind: 'document', name, text, shortened? }].
alter table public.tutor_messages add column attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array');

-- Photos (shrunk to JPEG in the browser) and PDFs: a private bucket, "<user id>/<chat id>/<file>", kept while the chat is.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-files', 'tutor-files', false, 25165824, array['image/jpeg', 'application/pdf']); -- photos are always shrunk to JPEG in the browser
create policy "tutor-files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'tutor-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tutor-files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'tutor-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tutor-files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'tutor-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
