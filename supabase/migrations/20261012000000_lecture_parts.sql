-- Accurate transcripts, part by part, safely. A part is claimed before it's sent to OpenAI, so two
-- requests can't transcribe (and charge) it twice; each finished part is saved on its own, so
-- parts finishing at the same time don't overwrite each other. These run with the student's own
-- session, so row-level security still limits them to their own lectures.

-- true if this request now owns part p_part (not transcribed, and not claimed in the last 10 minutes)
create function public.claim_lecture_part(p_lecture uuid, p_part int) returns boolean
language sql set search_path = '' as $$
  with claimed as (
    update public.lectures l
       set parts = jsonb_set(l.parts, array[p_part::text, 'claimed'], to_jsonb(now()))
     where l.id = p_lecture
       and p_part >= 0 and p_part < jsonb_array_length(l.parts)
       and coalesce((l.parts -> p_part ->> 'transcribed')::boolean, false) = false
       and (l.parts -> p_part ->> 'claimed' is null
            or (l.parts -> p_part ->> 'claimed')::timestamptz < now() - interval '10 minutes')
    returning 1
  )
  select exists (select 1 from claimed)
$$;

-- A transcription that failed gives the part back
create function public.release_lecture_part(p_lecture uuid, p_part int) returns void
language sql set search_path = '' as $$
  update public.lectures l set parts = l.parts #- array[p_part::text, 'claimed'] where l.id = p_lecture
$$;

-- Saves one part's lines and returns every part as it is now (null if it isn't the student's lecture)
create function public.save_lecture_part(p_lecture uuid, p_part int, p_segments jsonb) returns jsonb
language sql set search_path = '' as $$
  update public.lectures l
     set parts = jsonb_set(
           jsonb_set(l.parts #- array[p_part::text, 'claimed'], array[p_part::text, 'transcribed'], 'true'::jsonb),
           array[p_part::text, 'segments'], p_segments)
   where l.id = p_lecture
  returning l.parts
$$;

revoke execute on function public.claim_lecture_part(uuid, int) from public, anon;
grant execute on function public.claim_lecture_part(uuid, int) to authenticated;
revoke execute on function public.release_lecture_part(uuid, int) from public, anon;
grant execute on function public.release_lecture_part(uuid, int) to authenticated;
revoke execute on function public.save_lecture_part(uuid, int, jsonb) from public, anon;
grant execute on function public.save_lecture_part(uuid, int, jsonb) to authenticated;
