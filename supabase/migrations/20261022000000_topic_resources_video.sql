-- A video found on YouTube keeps its channel and length
alter table public.topic_resources
  add column channel text check (channel is null or length(channel) between 1 and 100),
  add column duration_seconds int check (duration_seconds is null or duration_seconds between 0 and 172800);
