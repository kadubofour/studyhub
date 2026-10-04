-- Scan uploads page photos to the same private "imports" bucket as PDF import; the route deletes
-- them after reading. Same own-folder policies; only the allowed types change.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'imports';
