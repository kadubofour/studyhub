-- What an exam needs that a task does not: what kind it is, how long it runs, where, what it covers and what it counts for.
-- All optional, and they live on tasks so an exam stays one row (lists, reminders, study plans and the calendar already read tasks).
alter table public.tasks
  add column exam_kind text check (exam_kind in ('quiz','test','midterm','final','practical','oral')),
  add column duration_min smallint check (duration_min between 5 and 720),
  add column location text check (length(location) between 1 and 120),
  add column covers text check (length(covers) between 1 and 1000),
  add column weight_pct smallint check (weight_pct between 0 and 100);
