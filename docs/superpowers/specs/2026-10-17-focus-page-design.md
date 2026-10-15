# Focus page: alerts, a task to work on, and session length

| Part | Decision |
|---|---|
| When time is up | A short chime, a browser notification (if allowed), a vibration on a phone, and the tab title changes to "Time's up" until the student comes back. Each can be turned off in a small "When time is up" card; sound is on by default, notifications ask permission when turned on |
| Next session | A switch "Start the next one automatically" (off by default): when on, a finished focus session rolls into its break, and a break into the next focus session, already running |
| What are you working on | A picker of open tasks (soonest due first) or nothing in particular. It is remembered across pages, shown under the clock, saved with the session (task and course), and when a focus session finishes the message offers to mark that task done |
| Length | Presets 15, 25, 45 and 50 minutes on the page, for the session about to start (not while it is running or partly done). Settings still decides the default |
| Database | `focus_sessions` gets `task_id` and `course_id` (both optional, set null if the task or course is deleted); a student can only link their own |
| Unchanged | Restart, Skip, the mode tabs, ambient sounds, XP and Progress |
