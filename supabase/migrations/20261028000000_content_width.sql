-- How wide the app's content is: focused (a centred column), wide, or the full window
alter table public.profiles add column content_width text not null default 'wide' check (content_width in ('focused', 'wide', 'full'));
