-- A quiz of only the questions a student missed can be short: one or two questions are allowed, not just three or more
alter table public.quizzes drop constraint quizzes_questions_check;
alter table public.quizzes add constraint quizzes_questions_check
  check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 30);
