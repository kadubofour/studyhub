-- U2a: topics per course, links from notes, lectures and decks, the cards' source note, saving a whole
-- edited topic list at once, and per-topic statuses worked out from the student's own answers.

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index topics_course_name on public.topics (course_id, lower(btrim(name)));
create index topics_course on public.topics (user_id, course_id, position);
alter table public.topics enable row level security;
create policy "own rows" on public.topics for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

create function public.owns_topic(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.topics t where t.id = tid and t.user_id = auth.uid())
$$;

create function public.topics_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.topics t where t.course_id = new.course_id) >= 40 then
    raise exception 'A course can have at most 40 topics' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger topics_limit before insert on public.topics for each row execute function public.topics_limit();

create table public.topic_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id uuid not null references public.topics on delete cascade,
  note_id uuid references public.notes on delete cascade,
  lecture_id uuid references public.lectures on delete cascade,
  deck_id uuid references public.decks on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(note_id, lecture_id, deck_id) = 1)
);
create unique index topic_links_note on public.topic_links (topic_id, note_id) where note_id is not null;
create unique index topic_links_lecture on public.topic_links (topic_id, lecture_id) where lecture_id is not null;
create unique index topic_links_deck on public.topic_links (topic_id, deck_id) where deck_id is not null;
create index topic_links_by_note on public.topic_links (note_id) where note_id is not null;
create index topic_links_by_lecture on public.topic_links (lecture_id) where lecture_id is not null;
create index topic_links_by_deck on public.topic_links (deck_id) where deck_id is not null;
alter table public.topic_links enable row level security;
create policy "own rows" on public.topic_links for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_topic(topic_id)
    and (note_id is null or public.owns_note(note_id))
    and (lecture_id is null or public.owns_lecture(lecture_id))
    and (deck_id is null or public.owns_deck(deck_id)));

-- A link's target must be in the same course as its topic
create function public.topic_link_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  topic_course uuid;
  target_course uuid;
begin
  select t.course_id into topic_course from public.topics t where t.id = new.topic_id;
  if new.note_id is not null then select n.course_id into target_course from public.notes n where n.id = new.note_id;
  elsif new.lecture_id is not null then select l.course_id into target_course from public.lectures l where l.id = new.lecture_id;
  else select d.course_id into target_course from public.decks d where d.id = new.deck_id;
  end if;
  if target_course is distinct from topic_course then
    raise exception 'A topic can only link to material in its own course' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger topic_link_check before insert or update on public.topic_links for each row execute function public.topic_link_check();

-- Moving a note, lecture or deck to another course drops its links (they would point across courses)
create function public.drop_stale_topic_links() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.course_id is distinct from old.course_id then
    if tg_table_name = 'notes' then delete from public.topic_links l where l.note_id = new.id;
    elsif tg_table_name = 'lectures' then delete from public.topic_links l where l.lecture_id = new.id;
    else delete from public.topic_links l where l.deck_id = new.id;
    end if;
  end if;
  return new;
end $$;
create trigger notes_topic_links after update of course_id on public.notes for each row execute function public.drop_stale_topic_links();
create trigger lectures_topic_links after update of course_id on public.lectures for each row execute function public.drop_stale_topic_links();
create trigger decks_topic_links after update of course_id on public.decks for each row execute function public.drop_stale_topic_links();

-- The note a card was made from (set by the generators); deleting the note just forgets it
alter table public.cards add column note_id uuid references public.notes on delete set null;
create index cards_note on public.cards (note_id) where note_id is not null;
drop policy "own rows" on public.cards;
create policy "own rows" on public.cards for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_deck(deck_id) and (note_id is null or public.owns_note(note_id)));

-- Saves a whole edited topic list for a course in one transaction (all or nothing).
-- p_topics: [{ "id"?: uuid, "name": text, "links": [{ "kind": "note"|"lecture"|"deck", "id": uuid }] }]
-- Security invoker: row-level security applies, so a student can only touch their own course and material.
create function public.save_course_topics(p_course uuid, p_topics jsonb) returns void
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
      insert into public.topic_links (topic_id, note_id, lecture_id, deck_id) values (
        tid,
        case when l ->> 'kind' = 'note' then (l ->> 'id')::uuid end,
        case when l ->> 'kind' = 'lecture' then (l ->> 'id')::uuid end,
        case when l ->> 'kind' = 'deck' then (l ->> 'id')::uuid end);
    end loop;
  end loop;
end $$;
grant execute on function public.save_course_topics(uuid, jsonb) to authenticated;

-- Where each topic stands, from the student's own answers over the last 30 days. Computed on demand, so it is
-- never out of date. Security invoker: only the student's own quizzes, cards and reviews are visible.
-- Right = a finished quiz attempt's answer marked correct, or a card review rated 3 or 4. An answer counts once
-- for each topic it belongs to (through its note, or its deck), even if both links point at the same topic.
create function public.topic_stats(p_course uuid)
returns table (topic_id uuid, name text, "position" int, answers_30d int, correct_30d int, answers_all int,
               last_practised timestamptz, notes int, lectures int, decks int, status text)
language sql stable security invoker set search_path = '' as $$
  with ans as (
    select qz.note_id as note_id, null::uuid as deck_id, qa.id::text || ':' || a.key as aid, qa.finished_at as at,
           coalesce((a.value ->> 'correct')::boolean, false) as ok
      from public.quiz_attempts qa
      join public.quizzes qz on qz.id = qa.quiz_id
      cross join lateral jsonb_each(qa.answers) a
     where qa.finished_at is not null
    union all
    select c.note_id, c.deck_id, r.id::text, r.reviewed_at, r.rating >= 3
      from public.reviews r join public.cards c on c.id = r.card_id
  ),
  hits as (
    select distinct tp.id as topic_id, x.aid, x.at, x.ok
      from public.topics tp
      join public.topic_links tl on tl.topic_id = tp.id
      join ans x on (tl.note_id is not null and tl.note_id = x.note_id) or (tl.deck_id is not null and tl.deck_id = x.deck_id)
     where tp.course_id = p_course
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
grant execute on function public.topic_stats(uuid) to authenticated;
