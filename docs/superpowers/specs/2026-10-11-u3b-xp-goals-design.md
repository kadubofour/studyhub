# U3b: XP, levels, daily goals and a study streak

Second of three U3 builds (U3a guided tutor, done; U3b this; U3c games). U3b adds a light motivation layer
made from things the student already does. It adds one read-only database function and no tables.

## 1. Goal

A student sees how much they have studied as points (XP), a level, three small goals for today, and a streak
of days they studied. Success: after reviewing cards, finishing a quiz and focusing, Home shows those goals
ticked, today's XP, the level and the streak; Progress shows the level, total XP, streaks and the last 14 days.

## 2. Decisions made

| Question | Decision |
|---|---|
| Where XP comes from | Worked out from existing data on demand (no new table, no award hooks): the student gets credit for past activity, and an action can never be counted twice |
| What earns it | Card reviews, finished quizzes, focus time, tasks done, study-plan sessions done, tutor messages sent, lectures recorded |
| Grinding | Each kind is capped per day (a repeated action stops paying) |
| Daily goals | Three fixed goals every day: review 10 cards, focus for 25 minutes, finish a quiz; all three together give a bonus |
| Level | From total XP; slower as it goes (see 4) |
| Streak | Consecutive days with any XP; today may still be empty and the streak continues from yesterday. The existing focus streak on Progress is separate and unchanged |
| Time zone | Days are the student's own (their profile's time zone) |
| Not in this build | Games (U3c), leaderboards, badges, notifications, animations |

## 3. Data

New migration `20261019000000_activity.sql`: `activity_by_day(p_tz text)` (security invoker, so only the
student's own rows): one row per local day that has any activity, with the day and these counts: `reviews`,
`quizzes` (finished attempts), `focus_minutes`, `tasks_done`, `plan_sessions` (sessions ticked in study plan
days, by the day they were ticked), `tutor_messages` (the student's own), `lectures` (recorded). Days come from
each record's own timestamp converted to `p_tz`.

## 4. The rules (in `lib/xp`, constants in one place)

| Kind | XP | Counted up to, per day |
|---|---|---|
| Card review | 1 each | 50 |
| Finished quiz | 10 each | 5 |
| Focus time | 1 per 5 minutes | 24 (two hours) |
| Task done | 5 each | 10 |
| Plan session done | 8 each | 8 |
| Tutor message | 2 each | 10 |
| Lecture recorded | 15 each | 2 |

- A day's XP is the capped sum, plus **20** if all three goals were met that day (goals use the raw counts).
- **Level** = floor(sqrt(total XP / 50)) + 1, so level 2 starts at 50 XP, 3 at 200, 4 at 450, 5 at 800. The
  screen shows XP into the current level and how many more are needed for the next.
- **Streak:** the run of consecutive days with XP above 0 that ends today, or ends yesterday if today has none
  yet. **Best** is the longest such run ever.
- **Goals:** each shows progress against its target and is done at or above it.

## 5. The screen

- **Home hero:** one extra small line under the focus bar: "Level 3 · 120 XP · 4-day streak" (the streak part
  omitted at 0). Shown once loaded; absent while loading or if loading fails.
- **Home "Daily goals" card** (after the tiles): the three goals with "4 / 10" style progress and a check and the
  word "Done" when met (never colour alone); "+25 XP today"; a bar "75 of 150 XP to level 4"; and "Finish all
  three for +20 XP" until they are. The card does not appear while loading or if loading fails.
- **Progress "XP" card:** level, total XP and the bar to the next level, current and best streak, and the last
  14 days as small bars (each with the day and XP as its title and a text alternative).
- Nothing is animated.

## 6. Edge cases

| Situation | Behaviour |
|---|---|
| A brand-new student | Level 1, 0 XP, goals at 0, no streak; the hero line reads "Level 1 · 0 XP" |
| Deleting a task, note or lecture | Its XP goes with it (XP is counted from what exists); accepted |
| The student changes time zone | Days are re-counted in the new zone |
| An invalid time zone | The lookup fails; Home and Progress show nothing extra |
| Loading fails | The XP parts are absent; everything else works |

## 7. Testing

- **DB:** counts per kind and day; time-zone day boundaries (the same record falls on different days in two
  zones); only the student's own data; plan sessions counted by their ticked day.
- **Unit:** the rules table; caps; the all-goals bonus; level boundaries (49/50/199/200 XP); streak with and
  without today, gaps and the best run; the goals' progress and done state; the last 14 days; the Home line and
  card (including hidden while loading and on failure); the Progress card.
- **E2E:** a new student sees Level 1 and 0 XP; ticking a task adds 5 XP; finishing a quiz adds 10 XP and
  ticks the quiz goal; both cards agree on Home and Progress.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 8. Build order

1. The database function and its tests.
2. The rules library and its tests.
3. The hook, the Home line and the Daily goals card.
4. The Progress card, E2E and a look at it in Classic and Paper on desktop and phone.
