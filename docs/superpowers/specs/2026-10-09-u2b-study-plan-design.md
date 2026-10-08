# U2b: The study plan

Second of three U2 builds (U2a topics and weak spots, done; U2b the study plan; U2c Home and tutor
tie-ins). U2b turns an exam date and the course's topics into a day-by-day plan, shows today's
sessions where the student already looks each day, and adjusts as they study.

## 1. Goal

A student picks an exam they already have in the Planner, a mode and a daily time, and gets a plan: a
short list of sessions for each day until the exam, ordered by what they most need to study. Each day's
sessions show as tick-off rows on Home and in the Planner. The plan reflects their results (weak topics
first), and when they miss a day the remaining work simply moves earlier. Success: with topics drafted
for a course and an exam set, a student makes a plan in under a minute, ticks today's sessions, takes a
Warm-up quiz, and sees tomorrow's plan change because of the result.

## 2. Decisions made

| Question | Decision |
|---|---|
| How the plan is worked out | By rules, no AI: free, instant and predictable, and re-planned from current results every time |
| Where it shows | Today's sessions in the existing day lists (Home "Today" and the Planner), set-up in a "Study plan" panel in the Planner. No new sidebar item |
| Warm-up | Included, simple: a 5-question quiz from the topic's newest linked note, made with the existing quiz maker (1 AI action). Its answers count in the topic's status like any quiz |
| Mode names | Sprint, Balanced, Deep dive; the starting check is the Warm-up |
| Exam dates | An existing Planner task of type exam; no new date entry |
| Not in this build | Home "revise these next" suggestions and the tutor knowing weak topics (U2c), editing individual sessions, calendar sync, AI-written plans |

## 3. Data

New migration `20261017000000_study_plans.sql`.

- `study_plans`: `id`, `user_id`, `course_id` (cascade), `exam_task_id` (the exam; deleting the exam
  deletes the plan), `mode` (`sprint` | `balanced` | `deep`, default `balanced`), `minutes_per_day`
  (10 to 240, default 45), `days_off` (weekday numbers 0 to 6, 0 is Sunday, default none). One plan per
  course. A check keeps the exam a task of type `exam` in the same course.
- `study_plan_days`: `id`, `user_id`, `plan_id` (cascade), `day` (the student's local date), `sessions`
  (jsonb array of `{ id, topic_id, kind: 'warmup' | 'learn' | 'revise', minutes, done_at }`), unique per
  plan and day. A day's row is created the first time that day is opened, so today's list does not
  reshuffle while the student works; it also records what was done, which the scheduler reads as history.
  Future days are never stored: they are worked out fresh each time.
- Row-level security: a student reads and writes only their own rows; the course, the exam task and the
  plan must be theirs.
- A plan is over when its exam is marked done or its day has passed; the app then hides it.

## 4. The scheduler

A pure function in `lib/plan/schedule.ts`, `buildPlan({ today, examDay, mode, minutesPerDay, daysOff,
topics })` returning `{ status, days, unscheduled }` (status `ok`, `no_topics`, `exam_passed` or `no_days`).
Each topic arrives with its status, whether it has a linked note, its position, its percentage right, when it
was last practised, and what the plan history says (a Learn done, a Warm-up done, the last day studied).

- **Study days:** every day from today to the day before the exam, minus days off. The exam day itself is
  not a study day.
- **Need order:** Weak, then Not started, then Covered, then Mastered. Within weak, lowest percentage first;
  otherwise the longest since practised, then topic order.
- **Topics chosen by mode:** Sprint takes the neediest 40% of the course's topics (at least 3), Balanced
  80%, Deep dive all. Mastered topics are only included in Deep dive.
- **Sessions:** a Not started topic gets a Warm-up (10 minutes, only if it has a linked note and none was
  done) then a Learn (25 minutes). A Weak topic gets a Learn. A Covered topic gets a Revise (15 minutes). A
  Learn already done is never repeated; the topic is treated as Covered. A good Warm-up result (answers that
  make it Covered) removes the Learn; a poor one (Weak) keeps it.
- **Placing:** the last two study days are kept for final revision (with 2 or fewer study days there is no
  reserve). The first pass places Warm-ups, Learns and Revises in need order into the earlier days, each day
  filled up to the daily minutes without splitting a session (a day always gets at least one session, even if
  it is longer than the minutes). After each Learn, a Revise is added at least 2 study days later where there
  is room. The reserved days get one Revise for every chosen topic, as many as fit.
- **What does not fit** is returned as `unscheduled` and shown as "N sessions don't fit. Choose Sprint or
  add minutes."
- **Adapting:** because the plan is recomputed from current results and history, a missed day moves
  everything earlier, and a good or poor Warm-up changes what comes next. The panel shows how many sessions
  from the last 7 days were missed.

## 5. The screen

- **Planner, "Study plan" panel** (Tasks tab): for each course that has an upcoming exam, either "Make a
  study plan for <exam>" (a form: mode as three radios with a one-line description each, minutes a day, days
  off) or its plan: a summary line (mode, minutes, "Exam in N days"), today's sessions as tick-off rows, the
  next 7 days (the day, then "Topic, kind, minutes" lines), "Missed this week: N" when there were misses,
  **Full schedule** (every day to the exam), **Edit plan** and **Delete plan** (after a confirm).
- **Session rows** (Planner panel and Home "Today"): a checkbox, "Learn: Krebs cycle", the course tag and the
  minutes, and an **Open** link to the topic's note (or Topics on Progress if it has none). A Warm-up row has
  **Start warm-up** instead: it makes the quiz (1 AI action) and opens it. Ticking a row saves it done and
  can be undone.
- **Home "Today":** today's sessions from every active plan appear above the tasks, in the same card.
- **Messages:** no topics yet → "Draft topics for <course> on Progress first." with a link; exam too close →
  "Your exam is too close for a plan." (no days to study); a plan whose exam has passed or is marked done is
  hidden.

## 6. Errors and edge cases

| Situation | What the student sees |
|---|---|
| A topic is deleted | Its sessions disappear from the lists; history for it is ignored |
| Exam moved to another date | The plan follows the task's new date automatically |
| Exam deleted | The plan is deleted with it |
| A day's list is opened twice at once | One row is created (unique per plan and day); the other open uses it |
| Warm-up with AI unavailable, daily limit or fair use | The usual messages; the session stays unticked |
| Offline | Ticking rolls back with the usual "Couldn't save" |
| Minutes a day smaller than a session | One session per day at least; the rest wait |

## 7. Out of scope

Home suggestions and tutor knowledge of weak topics (U2c); moving, resizing or deleting single sessions;
several plans per course; classes or other tasks as busy time; reminders and notifications; AI-written plans
or explanations.

## 8. Testing

- **Scheduler (unit, the bulk):** each mode's topic count; need order; Warm-up only with a note and not
  twice; Learn never repeated; a good Warm-up removes the Learn; days off respected; exam today or past;
  one study day; two or fewer days (no reserve); minutes smaller than a session; spaced Revise at least 2
  days after Learn; final-revision days; unscheduled when it does not fit; mastered topics only in Deep dive;
  deterministic output.
- **DB:** privacy of both tables; one plan per course; the exam must be an exam task in the same course;
  one row per plan and day; deleting the exam or the course deletes the plan and its days; days off values.
- **Unit (data and UI):** history summary from past days, the snapshot being created once, ticking and
  unticking, missed count, the plan form and its validation, the panel states, the Home rows, Start warm-up
  calling the quiz maker and opening the quiz.
- **E2E (fake AI):** set up topics and an exam, make a plan, see today's sessions on Home and the Planner,
  tick one, take a Warm-up and see it open a quiz, edit the plan, delete it.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 9. Build order

1. Migration and DB tests.
2. The scheduler and its unit tests.
3. History, snapshots and the data functions.
4. The plan hook, session rows, and the Home "Today" rows.
5. The Planner panel: set-up form, plan view, full schedule, edit and delete.
6. Start warm-up; E2E; a look at it in Classic and Paper on desktop and phone.
