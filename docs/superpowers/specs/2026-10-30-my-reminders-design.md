# My reminders

The student asked for "a reminders function". Studyhub already has automatic reminders, set up under Settings → Reminders: tasks due, exams, classes, cards due, the daily goal and the morning plan. They are off by default and easy to miss. What is missing is a reminder the student sets for themselves: "Remind me to email my tutor, Friday at 16:00", or "Take my vitamins, every day at 08:00".

## What the student gets

- **A Reminders page** (`/reminders`), in the sidebar after Planner, and in Search or jump.
  - **Upcoming:** each reminder shows what it says, when it is next due ("Today 16:00", "Tomorrow 08:00", "Fri 24 Oct 16:00") and how it repeats. They are sorted soonest first.
  - **Past:** one-off reminders whose time has gone, newest first, with **Clear past**.
  - Each reminder can be edited or deleted.
  - **Automatic reminders:** a card saying whether they are on, with a link to Settings → Reminders.
  - A line saying how they arrive: "Reminders show while Studyhub is open in a tab, and as a notification when your browser allows it."
- **New reminder** opens a dialog with:
  - What (required, up to 120 characters);
  - Date (today by default);
  - Time (the next whole hour by default);
  - Repeat: Once, Every day, Weekdays or Every week.

  The dialog is reached from the page, from the Create menu ("New reminder"), and from `/reminders?new=1`.
- **When it is due**, it appears the way the other reminders do: a toast with Open (it opens the Reminders page), and a browser notification when the tab is not in view.
  - A reminder the student set always shows. It does not depend on the automatic reminders' master switch or their quiet hours, because the student chose that time themselves.
  - As with the others, it is shown within 15 minutes of its time, and not replayed later.
- **Notification permission:** saving the first reminder asks the browser for it, if it has not been asked before.

## Rules

- Times are in the student's time zone (`profile.timezone`). A reminder stores a local date, a local time and how it repeats, so "every day at 08:00" stays 08:00 when the clocks change.
- **Repeats:**
  - Once: on its date only.
  - Every day: on its date and every day after.
  - Weekdays: Monday to Friday, from its date.
  - Every week: the same weekday as its date, from its date.
- A repeating reminder is never "past". Its next time is shown.
- **Keys** for "already shown": `custom:<id>:<local day>`. Editing a reminder's time gives it a new moment, so it can show again that day.

## Data

Migration `reminders`:

```sql
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  day date not null,
  at time not null,
  repeat text not null default 'once' check (repeat in ('once', 'daily', 'weekdays', 'weekly')),
  created_at timestamptz not null default now()
);
```

It has an index on `(user_id, day)`, row-level security limited to the student's own rows, and is part of the data download and account deletion as the other tables are.

## Code

- **`lib/reminders/mine.ts`** holds the pure functions:
  - `occursOn(r, dayKey)`;
  - `nextOccurrence(r, now, tz)`, which returns a `Date` or `null` for a one-off in the past;
  - `dueMine(rs, now, tz)`, which returns the `Reminder`s to show now (the occurrence today, or yesterday when 15 minutes before midnight cross the day);
  - `describeRepeat(r)` and `whenLabel(date, tz, now)`.
- **`lib/data/reminders.ts`** holds the data functions: `listReminders`, `createReminder`, `updateReminder`, `deleteReminder` and `deleteReminders(ids)`.
- **`ReminderProvider`** checks the student's own reminders whenever there are any, even with the automatic ones off. It reloads them on the same schedule, and when the Reminders page changes them (a `studyhub:reminders-changed` event).
- **The page:** `app/(app)/reminders/page.tsx` and `components/reminders/ReminderDialog.tsx`.
- **The shell:**
  - `PLACES` gets Reminders, with a Bell icon.
  - The Create menu gets `new-reminder`, which goes to `/reminders?new=1`.

## Not in this

- Reminders while Studyhub is closed. That needs web push (a service worker, a push service and a server-side schedule) and is a later piece of work.
- Snooze.
- Linking a reminder to a note or a task.
