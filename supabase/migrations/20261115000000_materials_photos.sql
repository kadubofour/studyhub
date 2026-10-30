-- The Library keeps photos too (JPEG, PNG, WebP), uploaded as files without a note
alter table public.materials drop constraint materials_mime_check;
alter table public.materials add constraint materials_mime_check check (mime in (
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/markdown',
  'image/jpeg', 'image/png', 'image/webp'));

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/markdown',
  'image/jpeg', 'image/png', 'image/webp']
where id = 'materials';
