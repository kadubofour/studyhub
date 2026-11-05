-- The tutor can read the files a student keeps. A kept file's text is taken out once, the first time the tutor needs it (lib/ai/tutorFiles.ts), and kept with
-- the file: 'pending' until then, 'ready' with its text, or 'no_text' for one with none to take (a scanned PDF, a photo).
alter table public.materials
  add column body text check (length(body) <= 200000),
  add column body_status text not null default 'pending' check (body_status in ('pending', 'ready', 'no_text')),
  -- the name's dots, dashes and underscores become spaces: "krebs-cycle.pdf" would otherwise read as one word and not be found by "krebs"
  add column body_tsv tsvector generated always as (to_tsvector('english'::regconfig, regexp_replace(name, '[._-]+', ' ', 'g') || ' ' || coalesce(body, ''))) stored;
create index materials_body_tsv on public.materials using gin (body_tsv);
update public.materials set body_status = 'no_text' where mime like 'image/%';

-- Finding the student's own material now covers their files too. A file that a note was made from is left out: the note says the same, and comes up itself.
-- A file can be long, so what comes back from one is the passages that match, not its first page.
create or replace function public.tutor_find_material(p_query text, p_limit int default 5)
returns table (kind text, id uuid, title text, snippet text)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('english', coalesce(p_query, '')) as tsq),
  docs as (
    select 'note'::text as kind, n.id, n.title, n.content_md as body, to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_md, '')) as tsv from public.notes n
    union all
    select 'lecture', l.id, l.title, b.body, to_tsvector('english', coalesce(l.title, '') || ' ' || b.body)
      from public.lectures l, lateral (select coalesce((select string_agg(t->>'text', ' ') from jsonb_array_elements(l.transcript) t), '') as body) b
    union all
    select 'card', c.id, left(c.front, 80), c.front || ' ' || c.back, to_tsvector('english', left(c.front, 80) || ' ' || c.front || ' ' || c.back) from public.cards c
    union all
    select 'file', m.id, m.name, coalesce(m.body, ''), m.body_tsv from public.materials m where m.note_id is null
  ),
  found as (
    select d.kind, d.id, d.title, d.body, ts_rank(d.tsv, q.tsq) as rank, q.tsq
      from docs d, q
     where q.tsq::text <> '' and d.tsv @@ q.tsq
     order by rank desc
     limit least(greatest(coalesce(p_limit, 5), 1), 10)
  )
  select f.kind, f.id, f.title,
         case when f.kind = 'file'
           then left(replace(replace(ts_headline('english'::regconfig, f.body, f.tsq, 'MaxFragments=5, MaxWords=60, MinWords=25, StartSel=[[, StopSel=]], FragmentDelimiter=" ... "'), '[[', ''), ']]', ''), 2000)
           else left(f.body, 2000) end as snippet
    from found f
   order by f.rank desc
$$;
