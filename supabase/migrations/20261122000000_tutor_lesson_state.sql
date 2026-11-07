-- Where a long lesson has got to, kept with its chat: the plan and what is covered. The tutor writes it as it teaches (a tool call, no approval, since
-- it is the tutor's own notes) and is given it again with every message, so the thread survives the few messages of history the tutor reads.
alter table public.tutor_chats add column lesson_state text check (length(lesson_state) <= 4000);
