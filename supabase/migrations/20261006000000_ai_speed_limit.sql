-- Phase 2: no caps on AI use. A speed limit (10 AI requests a minute per student) stops scripted
-- abuse; the app owner's prepaid OpenAI credit is the spending ceiling.
drop function public.consume_ai_import();
drop table public.ai_usage;

create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  at timestamptz not null default now()
);
create index ai_requests_user_at on public.ai_requests (user_id, at);
alter table public.ai_requests enable row level security;
-- Students can see their own requests; only ai_request_allowed (below) writes here
create policy "read own requests" on public.ai_requests for select using (user_id = (select auth.uid()));

-- Records one AI request and returns true, unless the caller already made 10 in the last minute.
create function public.ai_request_allowed() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  -- One student's parallel requests queue here, so ten at once can't all slip through
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if (select count(*) from public.ai_requests r
       where r.user_id = uid and r.at > now() - interval '60 seconds') >= 10 then
    return false;
  end if;
  insert into public.ai_requests (user_id) values (uid);
  delete from public.ai_requests r where r.user_id = uid and r.at < now() - interval '1 day';
  return true;
end $$;
revoke execute on function public.ai_request_allowed() from public, anon;
grant execute on function public.ai_request_allowed() to authenticated;
