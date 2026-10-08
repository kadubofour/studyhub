-- Review fixes for topics.
-- 1) A topic stays in the course it was made in: moving it would skip the 40-topic limit and the
--    same-course rule for its links.
create function public.topics_course_fixed() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.course_id is distinct from old.course_id then
    raise exception 'A topic cannot move to another course' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger topics_course_fixed before update of course_id on public.topics for each row execute function public.topics_course_fixed();

-- 2) topic_stats only reads the answers that belong to this course's linked notes and decks (it used to read
--    every quiz answer and review the student ever made, then match them with an OR join). The same results,
--    and a malformed 'correct' value now counts as not right instead of failing the whole function.
create or replace function public.topic_stats(p_course uuid)
returns table (topic_id uuid, name text, "position" int, answers_30d int, correct_30d int, answers_all int,
               last_practised timestamptz, notes int, lectures int, decks int, status text)
language sql stable security invoker set search_path = '' as $$
  with mine as (
    select tp.id as topic_id, tl.note_id, tl.deck_id
      from public.topics tp
      join public.topic_links tl on tl.topic_id = tp.id
     where tp.course_id = p_course and (tl.note_id is not null or tl.deck_id is not null)
  ),
  hits as (
    select m.topic_id, qa.id::text || ':' || a.key as aid, qa.finished_at as at,
           coalesce((a.value -> 'correct') = 'true'::jsonb, false) as ok
      from mine m
      join public.quizzes qz on qz.note_id = m.note_id
      join public.quiz_attempts qa on qa.quiz_id = qz.id and qa.finished_at is not null
      cross join lateral jsonb_each(qa.answers) a
    union
    select m.topic_id, r.id::text, r.reviewed_at, r.rating >= 3
      from mine m
      join public.cards c on c.note_id = m.note_id
      join public.reviews r on r.card_id = c.id
    union
    select m.topic_id, r.id::text, r.reviewed_at, r.rating >= 3
      from mine m
      join public.cards c on c.deck_id = m.deck_id
      join public.reviews r on r.card_id = c.id
  ),
  agg as (
    select h.topic_id,
           (count(*) filter (where h.at >= now() - interval '30 days'))::int as a30,
           (count(*) filter (where h.at >= now() - interval '30 days' and h.ok))::int as c30,
           count(*)::int as aall,
           max(h.at) as last_at
      from hits h group by h.topic_id
  )
  select tp.id, tp.name, tp.position,
         coalesce(g.a30, 0), coalesce(g.c30, 0), coalesce(g.aall, 0), g.last_at,
         (select count(*) from public.topic_links l where l.topic_id = tp.id and l.note_id is not null)::int,
         (select count(*) from public.topic_links l where l.topic_id = tp.id and l.lecture_id is not null)::int,
         (select count(*) from public.topic_links l where l.topic_id = tp.id and l.deck_id is not null)::int,
         case
           when coalesce(g.a30, 0) >= 10 and coalesce(g.c30, 0) * 100 >= coalesce(g.a30, 0) * 80 then 'mastered'
           when coalesce(g.a30, 0) >= 5 and coalesce(g.c30, 0) * 100 < coalesce(g.a30, 0) * 60 then 'weak'
           when coalesce(g.aall, 0) > 0 then 'covered'
           else 'not_started'
         end
    from public.topics tp
    left join agg g on g.topic_id = tp.id
   where tp.course_id = p_course
   order by tp.position
$$;
