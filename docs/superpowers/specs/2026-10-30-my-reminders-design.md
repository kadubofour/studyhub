# My reminders

The student asked for "a reminders function". Studyhub already has automatic reminders, set up under Settings → Reminders: tasks due, exams, classes, cards due, the daily goal and the morning plan. What was missing was a reminder the student sets for themselves, such as "Remind me to email my tutor, Friday at 16:00" or "Review the Cells deck, every day at 18:00".

**Revised (second request):** reminders have no page of their own. They are part of what they are about, and of where the student already plans their time.

## Where reminders are

- **Made from anywhere.**
  - "New reminder" in the Create menu, and in Search or jump, opens the reminder dialog over the page the student is on, the way Upload and Scan do.
  - Saving keeps them on that page.
- **"Remind me…" on the things they are about.** This opens the same dialog filled in for that thing. The reminder is linked to it, and its Open goes back there.
  - A **task**, from its row in the Planner: "Remind me about <task>". It is set for the task's due day (today if it has none) and points at the Planner.
  - A **note**, from its menu on the Notes page: "Review <note>". It points at the note.
  - A **deck**, on the deck's page: "Review <deck>". It points at the deck.
- **The Planner** lists them.
  - A **Reminders** entry in the Tasks tab's list of lists, with the number coming up, sits beside Today, Upcoming and the rest.
  - It shows **Upcoming** (soonest first, with when and how it repeats, and what it is about) and **Past** one-offs (with **Clear past**), each with edit and delete.
  - `/planner?list=reminders` opens it.
- **Home, Today:** today's reminders that are still to come are listed with their time, for example "16:00 · Email my tutor".
- **Settings → Reminders** (the automatic ones) says that the student's own reminders are in the Planner, with a link to them.

## The dialog

It has:
- What (required, up to 120 characters);
- Date (today by default);
- Time (the next whole hour by default);
- Repeat: Once, Every day, Weekdays or Every week;
- "About <thing>", when the dialog was opened from a thing, which the student can remove.

A one-off cannot be saved in the past, and this is checked again on Save. If saving fails, the dialog stays open with what was typed. The first time a reminder is saved, the browser is asked for permission to show notifications.

## When one is due

It shows as a toast with Open, and as a browser notification when the tab is not in view.
- Open goes to its thing, or to the Planner's Reminders list.
- It shows whatever the automatic reminders' master switch and quiet hours are, because the student chose the time.
- It is shown within 15 minutes of its time and not replayed later.

Reminders show while Studyhub is open in a tab. When it is closed they need web push, which is a later piece of work.

## Rules

- Times are in the student's time zone. A reminder stores its local date, local time and repeat.
- **Repeats:**
  - Once: on its date.
  - Every day: on its date and every day after.
  - Weekdays: Monday to Friday, from its date.
  - Every week: the same weekday as its date.
- The "already shown" key is `custom:<id>:<day>:<HH:MM>`.
- A link is a path inside Studyhub. It starts with a single `/`, so it can never send the student to another site.

## Data

Migration `20261106000000_reminders.sql` creates `public.reminders`:
- `id`, `user_id`, `created_at`;
- `title` (1 to 120 characters);
- `day date`, `at time`;
- `repeat` (`once`, `daily`, `weekdays` or `weekly`);
- `href text null` (an in-app path);
- `link_label text null` (up to 120 characters).

It is covered by row-level security limited to the student's own rows, and it is included in the data download and in account deletion.
