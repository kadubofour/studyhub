-- Notes: turn maths typed without dollars (x^2, a_n, \frac{a}{b}) into equations automatically.
-- On by default; students who write code or plain text can switch it off in Settings.
alter table public.profiles
  add column auto_math boolean not null default true;
