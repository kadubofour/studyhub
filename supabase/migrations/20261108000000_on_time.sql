-- Server-stamped "received" times on every record that earns XP.
-- The time a record claims (reviewed_at, done_at, ...) comes from the student's device and can be wrong or faked.
-- The received time is set by the database and a client can never write it, so later features can tell
-- activity that really happened now from activity that was back-dated.

-- a record counts as on time when the claimed and received times are within a day of each other
create function public.on_time(claimed timestamptz, received timestamptz) returns boolean
language sql immutable set search_path = '' as $$
  select received is not null and abs(extract(epoch from received - claimed)) <= 86400
$$;
grant execute on function public.on_time(timestamptz, timestamptz) to authenticated;

-- Columns and back-fill. The back-fill runs before the triggers exist, so history keeps its claimed time and still counts.
alter table public.reviews add column received_at timestamptz not null default now();
update public.reviews set received_at = reviewed_at;
alter table public.focus_sessions add column received_at timestamptz not null default now();
update public.focus_sessions set received_at = started_at;
alter table public.tutor_messages add column received_at timestamptz not null default now();
update public.tutor_messages set received_at = created_at;
alter table public.lectures add column received_at timestamptz not null default now();
update public.lectures set received_at = recorded_at;
alter table public.game_plays add column received_at timestamptz not null default now();
update public.game_plays set received_at = created_at;

alter table public.tasks add column done_received_at timestamptz;
update public.tasks set done_received_at = done_at where done_at is not null;
alter table public.quiz_attempts add column finished_received_at timestamptz;
update public.quiz_attempts set finished_received_at = finished_at where finished_at is not null;

update public.study_plan_days pd
   set sessions = (
     select coalesce(jsonb_agg(
       case when jsonb_typeof(s) = 'object' and s ->> 'done_at' is not null
            then s || jsonb_build_object('done_received_at', s ->> 'done_at')
            else s end
       order by n), '[]'::jsonb)
       from jsonb_array_elements(pd.sessions) with ordinality as e(s, n))
 where exists (select 1 from jsonb_array_elements(pd.sessions) s where jsonb_typeof(s) = 'object' and s ->> 'done_at' is not null);

-- Tables with a plain received_at: now() on insert; on update it keeps its old value unless the claimed time changed.
-- The claimed column is passed as the trigger argument.
create function public.stamp_received_at() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  claimed_old timestamptz;
  claimed_new timestamptz := to_jsonb(new) ->> tg_argv[0];
begin
  if tg_op = 'INSERT' then
    new.received_at := now();
  else
    claimed_old := to_jsonb(old) ->> tg_argv[0];
    if claimed_new is distinct from claimed_old then
      new.received_at := now();
    else
      new.received_at := old.received_at;
    end if;
  end if;
  return new;
end $$;

create trigger reviews_received before insert or update on public.reviews
  for each row execute function public.stamp_received_at('reviewed_at');
create trigger focus_sessions_received before insert or update on public.focus_sessions
  for each row execute function public.stamp_received_at('started_at');
create trigger tutor_messages_received before insert or update on public.tutor_messages
  for each row execute function public.stamp_received_at('created_at');
create trigger lectures_received before insert or update on public.lectures
  for each row execute function public.stamp_received_at('recorded_at');
create trigger game_plays_received before insert or update on public.game_plays
  for each row execute function public.stamp_received_at('created_at');

-- Tasks: done_received_at is null while done_at is null; stamped when done_at appears or changes.
create function public.stamp_task_done_received() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.done_at is null then
    new.done_received_at := null;
  elsif tg_op = 'INSERT' or new.done_at is distinct from old.done_at then
    new.done_received_at := now();
  else
    new.done_received_at := old.done_received_at;
  end if;
  return new;
end $$;
create trigger tasks_done_received before insert or update on public.tasks
  for each row execute function public.stamp_task_done_received();

-- Quiz attempts: the same rule for finished_at.
create function public.stamp_attempt_finished_received() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.finished_at is null then
    new.finished_received_at := null;
  elsif tg_op = 'INSERT' or new.finished_at is distinct from old.finished_at then
    new.finished_received_at := now();
  else
    new.finished_received_at := old.finished_received_at;
  end if;
  return new;
end $$;
create trigger quiz_attempts_finished_received before insert or update on public.quiz_attempts
  for each row execute function public.stamp_attempt_finished_received();

-- Study plan days: each session in the jsonb gets its own done_received_at. Whatever the client sent is dropped;
-- a session keeps the stamp it already had (matched by id) while its done_at is unchanged, otherwise it gets now().
create function public.stamp_session_done_received() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.sessions := (
    select coalesce(jsonb_agg(
      case
        when jsonb_typeof(s) <> 'object' then s
        when s ->> 'done_at' is null then s - 'done_received_at'
        else (s - 'done_received_at') || jsonb_build_object('done_received_at',
          coalesce(
            (select o ->> 'done_received_at'
               from jsonb_array_elements(case when tg_op = 'UPDATE' then old.sessions else '[]'::jsonb end) o
              where jsonb_typeof(o) = 'object' and o ->> 'id' = s ->> 'id'
                and o ->> 'done_at' = s ->> 'done_at' and o ->> 'done_received_at' is not null
              limit 1),
            to_jsonb(now())#>>'{}'))
      end order by n), '[]'::jsonb)
      from jsonb_array_elements(new.sessions) with ordinality as e(s, n));
  return new;
end $$;
create trigger study_plan_days_done_received before insert or update on public.study_plan_days
  for each row execute function public.stamp_session_done_received();
