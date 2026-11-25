-- Topics can cover the files a student uploaded (the ones with no note made from them), and a quiz can be made from one,
-- so a study plan works from everything in a course. A topic's status counts the answers to a file's quizzes like a note's.

create function public.owns_material(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.materials m where m.id = mid and m.user_id = auth.uid())
$$;

-- ---- Topic links to files ---------------------------------------------------------------------
alter table public.topic_links add column material_id uuid references public.materials on delete cascade;
-- the old "exactly one target" rule, whatever it was named
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.topic_links'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%num_nonnulls%' loop
    execute format('alter table public.topic_links drop constraint %I', c);
  end loop;
end $$;
alter table public.topic_links add check (num_nonnulls(note_id, lecture_id, deck_id, material_id) = 1);
create unique index topic_links_material on public.topic_links (topic_id, material_id) where material_id is not null;
create index topic_links_by_material on public.topic_links (material_id) where material_id is not null;

drop policy "own rows" on public.topic_links;
create policy "own rows" on public.topic_links for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_topic(topic_id)
    and (note_id is null or public.owns_note(note_id))
    and (lecture_id is null or public.owns_lecture(lecture_id))
    and (deck_id is null or public.owns_deck(deck_id))
    and (material_id is null or public.owns_material(material_id)));

create or replace function public.topic_link_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  topic_course uuid;
  target_course uuid;
begin
  select t.course_id into topic_course from public.topics t where t.id = new.topic_id;
  if new.note_id is not null then select n.course_id into target_course from public.notes n where n.id = new.note_id;
  elsif new.lecture_id is not null then select l.course_id into target_course from public.lectures l where l.id = new.lecture_id;
  elsif new.material_id is not null then select m.course_id into target_course from public.materials m where m.id = new.material_id;
  else select d.course_id into target_course from public.decks d where d.id = new.deck_id;
  end if;
  if target_course is distinct from topic_course then
    raise exception 'A topic can only link to material in its own course' using errcode = '23514';
  end if;
  return new;
end $$;

-- Moving a file to another course drops its links, like a note's
create or replace function public.drop_stale_topic_links() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.course_id is distinct from old.course_id then
    if tg_table_name = 'notes' then delete from public.topic_links l where l.note_id = new.id;
    elsif tg_table_name = 'lectures' then delete from public.topic_links l where l.lecture_id = new.id;
    elsif tg_table_name = 'materials' then delete from public.topic_links l where l.material_id = new.id;
    else delete from public.topic_links l where l.deck_id = new.id;
    end if;
  end if;
  return new;
end $$;
create trigger materials_topic_links after update of course_id on public.materials for each row execute function public.drop_stale_topic_links();

-- save_course_topics takes links of kind "file" too
create or replace function public.save_course_topics(p_course uuid, p_topics jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  t jsonb;
  l jsonb;
  tid uuid;
  pos int := 0;
  keep uuid[];
begin
  if p_course is null or not public.owns_course(p_course) then
    raise exception 'Not your course' using errcode = '42501';
  end if;
  if jsonb_typeof(p_topics) is distinct from 'array' or jsonb_array_length(p_topics) > 40 then
    raise exception 'A course can have at most 40 topics' using errcode = '22023';
  end if;
  select coalesce(array_agg((e ->> 'id')::uuid) filter (where e ->> 'id' is not null), '{}') into keep
    from jsonb_array_elements(p_topics) e;
  delete from public.topics tp where tp.course_id = p_course and tp.id <> all (keep);
  -- Park the kept names first so two topics can swap names without tripping the unique rule
  update public.topics tp set name = '~' || tp.id::text where tp.course_id = p_course;
  for t in select value from jsonb_array_elements(p_topics) loop
    pos := pos + 1;
    tid := null;
    if t ->> 'id' is not null then
      update public.topics tp set name = btrim(t ->> 'name'), position = pos
       where tp.id = (t ->> 'id')::uuid and tp.course_id = p_course returning tp.id into tid;
      if tid is null then raise exception 'Unknown topic' using errcode = '22023'; end if;
    else
      insert into public.topics (course_id, name, position) values (p_course, btrim(t ->> 'name'), pos) returning id into tid;
    end if;
    delete from public.topic_links tl where tl.topic_id = tid;
    for l in select value from jsonb_array_elements(coalesce(t -> 'links', '[]'::jsonb)) loop
      insert into public.topic_links (topic_id, note_id, lecture_id, deck_id, material_id) values (
        tid,
        case when l ->> 'kind' = 'note' then (l ->> 'id')::uuid end,
        case when l ->> 'kind' = 'lecture' then (l ->> 'id')::uuid end,
        case when l ->> 'kind' = 'deck' then (l ->> 'id')::uuid end,
        case when l ->> 'kind' = 'file' then (l ->> 'id')::uuid end);
    end loop;
  end loop;
end $$;

-- ---- Quizzes made from a file -----------------------------------------------------------------
-- Deleting the file just forgets it, as a deleted note's cards do
alter table public.quizzes add column material_id uuid references public.materials on delete set null;
create index quizzes_material on public.quizzes (material_id) where material_id is not null;
drop policy "own rows" on public.quizzes;
create policy "own rows" on public.quizzes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (note_id is null or public.owns_note(note_id)) and (material_id is null or public.owns_material(material_id)));

-- ---- Where a topic stands: its files' quizzes count too, and the result says how many files it has -------
drop function public.topic_stats(uuid);
create function public.topic_stats(p_course uuid)
returns table (topic_id uuid, name text, "position" int, answers_30d int, correct_30d int, answers_all int,
               last_practised timestamptz, notes int, lectures int, decks int, status text, files int)
language sql stable security invoker set search_path = '' as $$
  with mine as (
    select tp.id as topic_id, tl.note_id, tl.deck_id, tl.material_id
      from public.topics tp
      join public.topic_links tl on tl.topic_id = tp.id
     where tp.course_id = p_course and (tl.note_id is not null or tl.deck_id is not null or tl.material_id is not null)
  ),
  hits as (
    select m.topic_id, qa.id::text || ':' || a.key as aid, qa.finished_at as at,
           coalesce((a.value -> 'correct') = 'true'::jsonb, false) as ok
      from mine m
      join public.quizzes qz on qz.note_id = m.note_id
      join public.quiz_attempts qa on qa.quiz_id = qz.id and qa.finished_at is not null
      cross join lateral jsonb_each(qa.answers) a
    union
    select m.topic_id, qa.id::text || ':' || a.key, qa.finished_at,
           coalesce((a.value -> 'correct') = 'true'::jsonb, false)
      from mine m
      join public.quizzes qz on qz.material_id = m.material_id
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
         end,
         (select count(*) from public.topic_links l where l.topic_id = tp.id and l.material_id is not null)::int
    from public.topics tp
    left join agg g on g.topic_id = tp.id
   where tp.course_id = p_course
   order by tp.position
$$;
grant execute on function public.topic_stats(uuid) to authenticated;
