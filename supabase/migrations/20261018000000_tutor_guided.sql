-- Guided mode: the tutor asks first and gives hints in steps. Per chat, off by default.
alter table public.tutor_chats add column guided boolean not null default false;
