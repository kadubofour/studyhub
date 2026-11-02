-- Everything is in a notebook (a notebook is the student's study set): notes, decks, lectures and uploaded files each belong to
-- one, and nothing is left unfiled. One notebook per student is their General notebook, where what was made without choosing one goes.
-- Deleting a notebook moves what it held into General; General itself cannot be deleted.

alter table public.notebooks add column is_default boolean not null default false;
create unique index notebooks_one_default on public.notebooks (user_id) where is_default;

alter table public.decks add column notebook_id uuid references public.notebooks on delete set null;
alter table public.lectures add column notebook_id uuid references public.notebooks on delete set null;
alter table public.materials add column notebook_id uuid references public.notebooks on delete set null;
create index decks_notebook on public.decks (notebook_id);
create index lectures_notebook on public.lectures (notebook_id);
create index materials_notebook on public.materials (notebook_id);

-- The student's General notebook, made when it is first needed; null for a student who is gone (their things are being deleted with them)
create function public.default_notebook(uid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare nid uuid;
begin
  if not exists (select 1 from auth.users u where u.id = uid) then return null; end if;
  select b.id into nid from public.notebooks b where b.user_id = uid and b.is_default;
  if nid is null then
    insert into public.notebooks (user_id, name, is_default) values (uid, 'General', true) on conflict do nothing returning id into nid;
    if nid is null then select b.id into nid from public.notebooks b where b.user_id = uid and b.is_default; end if;
  end if;
  return nid;
end $$;
revoke execute on function public.default_notebook(uuid) from public, anon, authenticated;

-- A thing with no notebook goes in General; one in a notebook must be in its owner's own
create function public.file_in_notebook() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.notebook_id is null then
    new.notebook_id := public.default_notebook(new.user_id);
  elsif not exists (select 1 from public.notebooks b where b.id = new.notebook_id and b.user_id = new.user_id) then
    raise exception 'That notebook is not yours' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.file_in_notebook() from public, anon, authenticated;

create trigger file_in_notebook before insert or update of notebook_id on public.notes for each row execute function public.file_in_notebook();
create trigger file_in_notebook before insert or update of notebook_id on public.decks for each row execute function public.file_in_notebook();
create trigger file_in_notebook before insert or update of notebook_id on public.lectures for each row execute function public.file_in_notebook();
create trigger file_in_notebook before insert or update of notebook_id on public.materials for each row execute function public.file_in_notebook();

-- General stays
create function public.keep_default_notebook() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.is_default and exists (select 1 from auth.users u where u.id = old.user_id) then
    raise exception 'The General notebook cannot be deleted' using errcode = '23503';
  end if;
  return old;
end $$;
create trigger keep_default_notebook before delete on public.notebooks for each row execute function public.keep_default_notebook();
create function public.keep_default_flag() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_default is distinct from old.is_default then raise exception 'The General notebook cannot be changed that way' using errcode = '42501'; end if;
  return new;
end $$;
create trigger keep_default_flag before update on public.notebooks for each row execute function public.keep_default_flag();

-- A student cannot make themselves a second "default" by insert either
create function public.no_default_by_hand() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_default and current_user in ('authenticated', 'anon') then raise exception 'The General notebook is made for you' using errcode = '42501'; end if;
  return new;
end $$;
create trigger no_default_by_hand before insert on public.notebooks for each row execute function public.no_default_by_hand();

-- The notes policy asks whether the notebook is the student's own after the trigger above may have just made General in the same statement;
-- a stable function would not see it, so this one is volatile
create or replace function public.owns_notebook(nid uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select exists (select 1 from public.notebooks b where b.id = nid and b.user_id = auth.uid())
$$;

-- Today's loose things: into the notebook of their course (the first one that course has, or one made with the course's name), or General
do $$
declare r record; nid uuid;
begin
  for r in
    select distinct user_id, course_id from (
      select user_id, course_id from public.notes where notebook_id is null
      union select user_id, course_id from public.decks where notebook_id is null
      union select user_id, course_id from public.lectures where notebook_id is null
      union select user_id, course_id from public.materials where notebook_id is null
    ) loose
  loop
    if r.course_id is null then
      nid := public.default_notebook(r.user_id);
    else
      select b.id into nid from public.notebooks b where b.user_id = r.user_id and b.course_id = r.course_id and not b.is_default order by b.created_at limit 1;
      if nid is null then
        insert into public.notebooks (user_id, name, course_id)
          select r.user_id, left(c.name, 80), c.id from public.courses c where c.id = r.course_id
          returning id into nid;
      end if;
    end if;
    update public.notes set notebook_id = nid where user_id = r.user_id and course_id is not distinct from r.course_id and notebook_id is null;
    update public.decks set notebook_id = nid where user_id = r.user_id and course_id is not distinct from r.course_id and notebook_id is null;
    update public.lectures set notebook_id = nid where user_id = r.user_id and course_id is not distinct from r.course_id and notebook_id is null;
    update public.materials set notebook_id = nid where user_id = r.user_id and course_id is not distinct from r.course_id and notebook_id is null;
  end loop;
end $$;
