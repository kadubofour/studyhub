-- activity_by_day reads the student's own rows from these two tables; without these it would scan every student's
create index tutor_messages_user_time on public.tutor_messages (user_id, created_at) where role = 'user';
create index study_plan_days_user on public.study_plan_days (user_id);
