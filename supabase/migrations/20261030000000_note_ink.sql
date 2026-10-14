-- Pen and highlighter drawn directly on a note: a list of marks (strokes, shapes, text) in the note's own coordinates
alter table public.notes add column ink jsonb not null default '[]'::jsonb
  check (jsonb_typeof(ink) = 'array' and jsonb_array_length(ink) <= 4000 and octet_length(ink::text) <= 1500000);
