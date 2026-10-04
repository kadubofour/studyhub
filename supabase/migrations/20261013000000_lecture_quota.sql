-- The 300 MB lecture-audio limit, enforced by storage itself (not only in the browser), using the
-- real size of each student's audio files.

-- The signed-in student's lecture audio, in bytes
create function public.lecture_audio_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
    from storage.objects o
   where o.bucket_id = 'lectures' and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;
revoke execute on function public.lecture_audio_bytes() from public, anon;
grant execute on function public.lecture_audio_bytes() to authenticated;

-- New audio only while the student is under the limit (one part, at most 60 MB, may go over it)
drop policy "lectures: upload own" on storage.objects;
create policy "lectures: upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lectures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.lecture_audio_bytes() < 314572800
  );
