# Exams in the planner: design

## Understanding

- **Said:** the planner's Add task and Add exam buttons open the same dialog, and the exam dialog does not fit how exams are actually planned.
- **Found:** both buttons (the Week tab's toolbar and its phone round button) open the one `TaskDialog`; "exam" is only a chip on it. An exam is stored as a task with a due *day* (end of day), so it has no start time, length, room or what it covers, and it shows on the calendar as a flag in the all-day row.
- **How exams are planned, as assumed (recommended options):** a student writes down which course, what kind (quiz, test, midterm, final, practical, oral), the date **and start time**, how **long** it runs, **where** (room, hall, seat), **what it covers** (chapters, topics) and how much it **counts** towards the grade. Then they plan revision backwards from it.

## What changes

| Part | Behaviour |
|---|---|
| Add task | Its own simple dialog: title, type (Task, Assignment, Reading), priority, course, due date. No Exam chip. |
| Add exam | Its own dialog: course (needed), kind, title (filled in from course and kind until you type your own), date, start time (or "time not announced yet"), length, where, what it covers, counts for (%). |
| Editing | An exam opens the exam dialog wherever it is opened (list, calendar, month, chips). |
| Calendar | An exam with a start time is a **block** in the day and week grid from its start to its end, with the room, instead of a flag in the all-day row. An exam with no time yet stays in the all-day row. Month view shows it as a chip with its time. |
| Task list | An exam row says when, how long and where ("Thu 14 Nov, 14:00 to 16:00 · Hall B") and how far away it is ("in 12 days"). |
| After saving | A new exam offers "Plan revision", which goes to the Tasks tab where the study-plan panel already offers a plan for the course's next exam. |
| Reminders | Unchanged: they count back from the exam's start time (now an exact time instead of the end of the day). |

## Data

`tasks` gets nullable columns: `exam_kind` (quiz, test, midterm, final, practical, oral), `duration_min` (5 to 720), `location` (up to 120 characters), `covers` (up to 1000), `weight_pct` (0 to 100). Existing exams keep working: an exam whose due time is the end of the day (23:59:59 local) is "no time yet".

## Parts

`lib/exams.ts` (pure: kinds, durations, time and no-time rules, start and end, title suggestion, the one-line description, countdown); `components/planner/ExamDialog.tsx`; `TaskDialog` hands exams to it and drops the Exam chip; `lib/calendar/events.ts` (`examBlocks`, and `dayItems` can leave timed exams out); `TimeGrid` draws the blocks; `TaskRow` and `TaskCard` show the exam line; migration `20261102000000_exam_details.sql`.

## Not in this piece

Seat numbers and "what is allowed in the room" lists, exam clashes warnings, importing a timetable of exams, a revision plan built from "what it covers".
