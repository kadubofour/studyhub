# Reminders: design

The Focus page's "When time is up" card moves into Settings, and Studyhub reminds the student about everything else that needs it.

## Understanding

- **Who and why:** a student who forgets deadlines, classes and review sessions. They want Studyhub to tell them, on their phone or laptop, without opening the app.
- **Said:** put "when time is up" in Settings; add reminders for everything else that may need one.
- **Assumed (recommended options, per the standing instruction):** reminders work while Studyhub is open in any tab or window (a browser cannot wake a closed app without push notifications and a server job, which is a separate piece of work and is called out in Settings); each kind has its own switch and lead time; nothing is on until the student turns reminders on; quiet hours stop reminders at night.

## What gets a reminder

| Reminder | When it fires | Setting |
|---|---|---|
| Task due | A set time before the due time: at the time, 15 min, 1 hour (default), 3 hours, 1 day | lead, or off |
| Exam coming | Same, with its own lead (default 1 day) | lead, or off |
| Class starting | Before a timetable class: 5, 10 (default), 15, 30 min | lead, or off |
| Flashcards due | Once a day at a time (default 18:00), only if cards are due | time, or off |
| Daily goal | Once a day at a time (default 20:00), only if today's focus is under the goal | time, or off |
| Today's plan | Once a day at a time (default 08:00), only if something is due or a class is on | time, or off |
| Focus time up | Existing: chime, vibration, notification, tab title; "start the next one automatically" | moved here, unchanged |

Quiet hours (default 22:00 to 07:00, switchable) hold back every reminder except the focus timer, which the student started themselves.

## Behaviour

- A reminder is **due** in the 15 minutes after its moment. A task or class whose moment falls in quiet hours is told about just before they begin ("Due soon") rather than dropped. Opening Studyhub later does not replay old reminders.
- Each reminder fires **once**: its key (kind, thing, moment) is remembered on this device for three days. A task whose due time changes gets a new key and so a new reminder.
- A reminder is shown as a browser notification when the tab is hidden and the browser allows it, and as a toast with an Open button when the student is looking at the page. Without permission, the toast alone is used.
- Reminders are shown during a focus session too (a toast is quiet, and a class will not wait). Several at once are one toast.
- A tab the student is not looking at sends the notification and marks the reminder; the first tab they look at shows the toast once more.
- Settings are kept on this device (like focus alerts); a notification belongs to a device anyway.

## Parts

- `lib/reminders/prefs.ts`: the settings (`localStore`), cleaned on read.
- `lib/reminders/engine.ts`: pure `dueReminders(input)` and `inQuietHours`. Takes the clock, time zone, settings, open tasks, classes, due cards, today's minutes and goal; returns reminders `{ key, title, body, href }`.
- `components/providers/ReminderProvider.tsx`: inside the app layout; every 30 seconds runs the engine; reloads tasks, classes and due cards every 5 minutes and when the tab returns; delivers and remembers.
- `components/settings/RemindersCard.tsx` and a Reminders section in Settings (master switch asks for notification permission, a "Send a test reminder" button, each row above, quiet hours, and the moved focus card).
- The Focus page shows a one-line link to those settings where the card was.

## Not in this piece

Reminders while Studyhub is closed (web push), email or SMS, repeating custom reminders.
