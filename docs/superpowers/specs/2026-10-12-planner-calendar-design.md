# Planner calendar, better tasks, darker Upload and Scan

Three asks: a calendar like the reference screenshot (toolbar, Day/Week/Month, mini month, an Add menu, today highlighted, a red "now" line, an invitation when empty), a better task system, and solid darker Upload and Scan buttons in the sidebar.

## Decisions
| Question | Decision |
|---|---|
| Tabs | The planner has **Tasks** and **Calendar**. Calendar replaces the old Week and Timetable tabs (classes are now added and edited on the calendar itself) |
| Calendar toolbar | Today, previous and next, the range title ("Oct 12 – 18, 2026"), Day / Week / Month switch, and an **Add** menu: Class, Exam date, Task |
| Day and Week | An hour grid from 07:00 (wider when a class needs it), an all-day strip on top, today's column tinted, a red line at the current time (in the student's time zone), and the grid scrolled so the current time is in view. Classes are blocks coloured by course; overlapping classes sit side by side. Click an empty slot to add a class there |
| All-day strip | Deadlines (tasks with a due date, exams first and bold) and study plan sessions for that day. Click a deadline to edit it |
| Month | A month grid, up to 3 items per day and "+N more", clicking a day opens it in Day view |
| Mini month | Beside the grid on wide screens: small month, today ringed, the shown range tinted, click a day to go there, arrows change month. Hidden on phones (the toolbar does the job) |
| Empty | When there are no classes and no tasks at all, a centred card: "Add your first exam" with a button |
| Week starts | Monday, as everywhere else in the app |
| Tasks: editing | Click a task title to open the same dialog used by the calendar: title, type, course, due date, priority, mark done, delete |
| Tasks: priority | Low / Normal / High. High shows a flag; within a day, high comes first. Quick add understands a trailing `!` ("Essay fri !") as high |
| Tasks: done | A collapsible **Done** section with the last 7 days of finished tasks, each with an untick that brings it back |
| Tasks: filtering | Type chips with counts (All, Tasks, Assignments, Exams, Readings) next to the course filter |
| Sidebar buttons | Upload and Scan become solid, a shade darker than the sidebar, no dashed outline; a little lighter on hover |
| Not in this build | Dragging events, times on tasks, recurring tasks, subtasks, Google or Canvas calendar sync, event reminders |

## Pure logic (lib/calendar)
range (visible days per view, month grid of whole Monday weeks, moving the anchor a day, week or month, the title), now line offset, class lanes for overlaps, per-day all-day items (tasks sorted exam, high, due; plan sessions).

## Testing
Unit for every pure helper, the dialog, the toolbar, the grids, the mini month, the planner page, the task row and quick add; e2e for adding an exam from the calendar, editing a task, ticking and unticking from Done, the sidebar buttons; axe on the planner in every look.
