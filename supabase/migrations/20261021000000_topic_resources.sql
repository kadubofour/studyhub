-- Videos and articles a student keeps for a topic (found with the web search tool, saved by the browser).
create table public.topic_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id uuid not null references public.topics on delete cascade,
  url text not null check (url ~* '^https?://' and length(url) <= 500),
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('video', 'article')),
  created_at timestamptz not null default now(),
  unique (topic_id, url)
);
create index topic_resources_topic on public.topic_resources (topic_id, created_at);
alter table public.topic_resources enable row level security;
create policy "own rows" on public.topic_resources for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_topic(topic_id));

create function public.topic_resources_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.topic_resources r where r.topic_id = new.topic_id) >= 20 then
    raise exception 'A topic can keep at most 20 links' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger topic_resources_limit before insert on public.topic_resources for each row execute function public.topic_resources_limit();
