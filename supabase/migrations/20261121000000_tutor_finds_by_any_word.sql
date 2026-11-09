-- The tutor finds the student's material by any of the words in a question, not all of them: a question such as "can you explain how the Krebs cycle works" used
-- to match only a document containing every word, so most real questions found nothing. Documents with more of the words still rank first.
create or replace function public.tutor_find_material(p_query text, p_limit int default 5)
returns table (kind text, id uuid, title text, snippet text)
language sql stable security invoker set search_path = '' as $$
  with q as (select replace(plainto_tsquery('english', coalesce(p_query, ''))::text, ' & ', ' | ')::tsquery as tsq),
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
