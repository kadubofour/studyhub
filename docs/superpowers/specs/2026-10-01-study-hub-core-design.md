# Study Hub — Phase 1 (Core Hub) Design

Date: 2026-10-01
Status: Draft — awaiting review

## 1. Goal

A web app for students in general: one calm, low-clutter hub to plan coursework, keep a class
timetable, take notes, memorize with flashcards, and focus with a Pomodoro timer.

Success: a student opens the app, sees what to do today, and starts a task, a review, or a
focus session in one click.

### Roadmap context (not in this phase)

| Phase | Scope |
|---|---|
| 1. Core hub (this spec) | Accounts, home, planner + timetable, notes, flashcards, focus, progress |
| 2. Scan + AI study tools | **Scan documents** (camera, image, or PDF → AI vision) into a note, flashcards, or tasks/timetable, always via an editable review step; generate flashcards from notes, summaries, quizzes |
| 3. AI tutor & planner | Tutor chat; "exam on the 20th" → auto-scheduled study sessions |
| 4. Discover | Recommended YouTube videos (YouTube Data API) and web resources (web search), ranked by AI — never AI-invented links |

Phase 1 must leave room for these: the API key will live in Next.js server routes, notes are
stored as Markdown (easy to send to a model), and courses tie everything together. Notes,
Flashcards, and Planner headers reserve space for a future "Scan" action, and creating
notes/cards/tasks/classes goes through shared functions that a scan review step can reuse.

## 2. Decisions

| Topic | Decision |
|---|---|
| Users | Individual students; no collaboration in Phase 1 |
| Platform | Responsive web app, desktop-first, usable on phones |
| Stack | Next.js (App Router, TypeScript) + Supabase (Postgres, Auth) hosted on Vercel |
| Sign-in | Email/password and Google OAuth; no email confirmation required |
| Planner model | Courses → tasks; list view + week view; timetable of recurring classes |
| Flashcards | Spaced repetition (SM-2), ratings Again / Hard / Good / Easy |
| Focus | Pomodoro cycles, daily goal + streak, ambient sounds; not linked to courses |
| Notes | One editor (Tiptap) with Rich / Markdown toggle per note; KaTeX math; stored as Markdown |
| Style | Clean, minimal, compact; light / dark / system theme toggle |

## 3. Pages

| Route | Purpose |
|---|---|
| `/` | Landing: log in / sign up |
| `/login`, `/signup` | Email + password, "Continue with Google", forgot password |
| `/onboarding` | First login: name, daily focus goal, first course (all skippable) |
| `/home` | Compact home screen (see 4.1) |
| `/planner` | Course filter chips; tabs: Tasks, Week, Timetable |
| `/notes`, `/notes/[id]` | Notes list (by course, searchable) and editor |
| `/flashcards`, `/flashcards/[deck]` | Deck grid with due counts; card editor |
| `/review` (`?deck=`) | Spaced-repetition review session |
| `/focus` | Pomodoro timer + ambient sounds |
| `/progress` | Streaks, focus heatmap, review stats |
| `/settings` | Profile, daily goal, timer lengths, default editor mode, theme, sign out |

Navigation: left sidebar on desktop (Home, Planner, Flashcards, Focus, Notes, Progress;
Settings at bottom), bottom tab bar on mobile.

## 4. Screens

### 4.1 Home (deliberately minimal)

- Greeting + date. No streak, no metric tiles, no charts.
- **Today**: tasks due today and overdue, each with course color dot and a checkbox; inline
  "Add a task".
- One row of quiet buttons: next class (course + time), "Review N cards" (only if cards are
  due), "Focus".

### 4.2 Planner

- **Tasks tab**: quick-add input parsing natural dates ("Calc problem set fri"); groups
  Overdue (red header), Today, Upcoming. Each row: checkbox, course dot, title, type pill,
  due date.
- **Week tab**: Mon–Sun calendar; classes as colored blocks at their times; deadlines as
  dashed flags at the top of their day.
- **Timetable tab**: same grid, editable — add/edit/delete recurring classes.

### 4.3 Notes

- Left: search + list grouped/filterable by course. Right: editor.
- Rich mode: toolbar (bold, italic, heading, lists, checklist, code, equation) and Markdown
  input shortcuts. Markdown mode: raw source with live preview.
- Math via `$inline$` and `$$block$$`, rendered with KaTeX in both modes.
- Autosave ~1s after typing stops; subtle "Saved" indicator.

### 4.4 Flashcards

- Deck grid (name, course, cards due). Deck page: add/edit/delete cards (front/back, math
  supported).
- Review: progress bar, card front → "Show answer" (space) → rate Again/Hard/Good/Easy
  (keys 1–4), each button shows the next interval. End-of-session summary.

### 4.5 Focus

- Large ring timer; modes Focus / Short break / Long break; Start/Pause, Skip.
- Defaults 25 / 5 / 15 min, long break every 4 sessions; editable in Settings.
- Ambient sounds: Off, Rain, Café, Lo-fi (bundled looping audio) + volume.
- Shows today's focus vs daily goal.

### 4.6 Progress

- Current streak, best streak, focus this week, card retention rate.
- 12-week focus heatmap; cards reviewed per day.

## 5. Data model (Supabase Postgres)

All tables have `id uuid pk`, `user_id uuid → auth.users`, `created_at`, and row-level
security policies restricting every operation to `user_id = auth.uid()`.

| Table | Fields |
|---|---|
| `profiles` | `display_name`, `timezone`, `daily_goal_minutes`, `focus_minutes`, `short_break_minutes`, `long_break_minutes`, `long_break_every`, `default_editor_mode` (rich/markdown), `theme` (light/dark/system) |
| `courses` | `name`, `color` |
| `tasks` | `course_id?`, `title`, `type` (assignment/exam/reading/other), `due_at?`, `priority` (low/normal/high), `done_at?` |
| `classes` | `course_id`, `day_of_week` (0–6), `start_time`, `end_time`, `location?`, `kind` (lecture/lab/tutorial/seminar/other) |
| `notes` | `course_id?`, `title`, `content_md`, `updated_at` |
| `decks` | `course_id?`, `name` |
| `cards` | `deck_id`, `front`, `back`, `due_at`, `interval_days`, `ease`, `reps`, `lapses` |
| `reviews` | `card_id`, `rating` (1–4), `reviewed_at`, `prev_interval_days`, `new_interval_days` |
| `focus_sessions` | `started_at`, `ended_at`, `minutes`, `completed` (bool) |

Derived, not stored:
- **Streak** = consecutive days (in the user's timezone) where summed focus minutes ≥
  `daily_goal_minutes`.
- **Cards due** = cards with `due_at ≤ now`.
- **Retention** = share of reviews rated ≥ Good over the last 30 days.

## 6. Core logic units

Pure, framework-free TypeScript modules (in `lib/`), each unit-tested:

- `srs.ts` — SM-2 scheduling: `(cardState, rating, now) → newCardState`. Swappable for FSRS later.
- `streak.ts` — `(sessions, goal, timezone, today) → { current, best }`.
- `dates.ts` — today/overdue/upcoming bucketing in a given timezone.
- `quickAdd.ts` — parse "title + natural date" into `{ title, dueAt }`.
- `timer.ts` — remaining time from a start timestamp + durations (robust to tab sleep).

## 7. Auth, saving, and errors

- **Auth**: Supabase Auth; email/password (no confirmation; signup asks for email twice) and
  Google OAuth. Middleware redirects unauthenticated requests to `/login?next=…`. First login
  → `/onboarding`.
- **Security**: RLS on every table; tests prove cross-user access is denied.
- **Saving**: optimistic UI for task toggles, ratings, class edits. On failure: revert + toast
  "Couldn't save. Retry".
- **Notes**: debounced autosave (~1s); last-write-wins.
- **Focus sessions**: saved on completion, or on early stop if ≥ 5 minutes.
- **Timezone**: stored on profile (detected at signup); all "today" logic uses it.
- **Offline**: not supported in Phase 1 beyond an "You're offline" banner and retrying
  pending writes on reconnect.
- **Deleting a course**: prompt — delete its tasks/decks/notes, or keep them as "No course".
  Classes are always deleted with the course.
- **Empty states**: one inviting prompt per screen ("Add your first course", "Create a deck").

## 8. Testing

- **Unit (Vitest)**: all modules in section 6.
- **Database**: RLS tests — user A cannot read/update/delete user B's rows.
- **End-to-end (Playwright)**: sign up → add course → add task → complete it; create deck →
  review cards; run a focus session; write a note → reload → persists.
- **Visual**: desktop + mobile widths, light + dark.

## 9. Build order

1. Project setup, auth, app shell (sidebar / bottom tabs), theming.
2. Courses + planner Tasks tab, Home screen.
3. Timetable + Week view.
4. Flashcards (decks, cards, SRS review).
5. Focus timer + ambient sounds.
6. Notes editor (Rich/Markdown/math).
7. Progress + Settings.

## 10. Out of scope (Phase 1)

AI features, document scanning (Phase 2), recommendations, collaboration/sharing, file/PDF uploads, rotating (A/B-week)
timetables and one-off class changes, linking focus sessions to courses, full offline mode,
drag-and-drop time-blocking, native mobile apps.
