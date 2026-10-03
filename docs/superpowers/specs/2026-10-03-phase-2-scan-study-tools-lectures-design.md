# Studyhub — Phase 2 (Scan, AI study tools, Lectures) Design

Date: 2026-10-03
Status: Draft — awaiting review
Builds on: `2026-10-01-study-hub-core-design.md` (Phase 1) and the AI PDF import added after it.

## 1. Goal

Turn what students already have — handouts, whiteboards, timetables, their notes, and the
lectures they sit through — into study material with as little typing as possible.

Success: a student photographs a three-page handout and gets a clean note; from that note they
make 15 flashcards and a quiz in under a minute each; they record a lecture, get a transcript,
turn it into a note; and they watch their quiz scores improve on Progress.

Three parts, designed together and built in the order in §11:

| Part | What it does |
|---|---|
| 2a. Scan | Camera photos, images or a PDF (up to 10 pages) → a note, flashcards, or planner tasks/classes, via an editable review step |
| 2b. Study tools | From a note: flashcards, a summary saved at the top of the note, and retakeable quizzes with score history |
| 2c. Lectures | Record a lecture (free live transcript, accurate transcript, or audio only), keep the audio with a tap-to-seek transcript, and turn it into a note |

## 2. Decisions

| Topic | Decision |
|---|---|
| AI review | Nothing AI-made is saved without the student seeing it. Scans and generated flashcards go through a review step; a summary can be removed or regenerated. |
| Quiz | Mixed types: multiple choice (4 options), true/false, short answer (marked by AI). Answer and a one-line explanation shown after each question. Saved under the note, retakeable, score history on Progress. Wrong answers → flashcards in one tap. |
| Summary | A quote block at the very top of the note, first line `**Summary**`, saved as part of the note's Markdown. Regenerate replaces it; Remove deletes it. |
| Flashcards destination | A deck the student picks; default is a new deck named after the note. |
| Scan pages | Up to 10 per scan, reorderable, removable, retakeable. |
| Lecture transcription | Default: free live transcript (browser speech recognition). Opt-in: accurate transcript from AssemblyAI. Or record only. |
| Lecture audio | Kept, with playback and tap-a-line-to-seek. |
| Plans/billing | None. Everyone gets everything; limits live in one place so plans can be added later. |
| Models | Claude Haiku 4.5 (`claude-haiku-4-5`) for flashcards, summaries, quizzes, quiz marking. Claude Sonnet 5.5 (`claude-sonnet-5-5`) for scans, PDF import (moved from Opus 5.5) and lecture notes. |
| Limits | 20 AI actions per student per UTC day (every Claude call except quiz marking). 3 hours of accurate transcription per rolling 7 days, max 2 hours per lecture. Recording and live transcripts are unlimited. |
| Charging | Check before, count only after success. Failed or cancelled work is free. |
| Transcription provider | AssemblyAI, model Universal-2 ($0.15/hr; mono audio). Universal-3.5 Pro ($0.21/hr) is a one-constant switch if accuracy needs it. New accounts get $50 free credit. Deepgram Nova-3 (~$0.26/hr) was the alternative. |

## 3. Pages and entry points

- **Note editor → Study panel.** A "✦ Study" button in the note header opens a panel beside the
  note (a bottom sheet on phones) with three tabs: **Summary**, **Cards**, **Quiz**. Each shows
  "N of 20 AI actions left today".
- **Scan buttons** in the headers of **Notes** (→ note), **Flashcards** (→ cards) and **Planner**
  (→ tasks and/or classes). The result type is preset by where Scan was opened and can be changed.
- **Lectures page** — new sidebar item between Notes and Progress: list of lectures (title,
  course, date, length, transcript status), a **Record** button, and the lecture page.
- **Home** shows "N of 20 AI actions · Xh Ym transcription left this week" in small text.
- **Progress** gains a "Quiz scores" chart per course (best score per quiz over time).
- **Settings** shows lecture storage used ("410 MB of audio").

## 4. Flows

### 4.1 Scan (agreed mockup: three steps)
1. **Add pages** — take photos (`<input capture>` on phones), choose images or one PDF; thumbnails
   to reorder/remove; pick what to make and where (note + course; deck; planner). Button
   "✦ Scan N pages · uses 1 AI action".
2. **Reading…** — progress text, "usually 10–30 seconds", Cancel (aborts the request; not charged).
3. **Review, then save** —
   - **Note:** title, course, editable Markdown preview (same component as PDF import review).
   - **Flashcards:** list of front/back cards, each editable and tickable; "Save N cards".
   - **Planner:** tasks (title, type, due date) and weekly classes (course, day, start, end,
     room, kind), each editable and tickable. Items the model was unsure about are flagged
     "check this". Classes must belong to a course: the model's course name is matched to an
     existing course (case-insensitive), otherwise the review offers "create course <name>" or a
     picker.
   - "↺ Scan again" returns to step 1 with the same pages.

### 4.2 Study panel
- **Summary tab:** "✦ Summarise" (1 action) inserts or replaces the summary block at the top of
  the note; "Remove summary". Disabled for notes under ~40 words ("Too short to summarise").
- **Cards tab:** "✦ Make flashcards" (1 action) → review list as in 4.1 with deck picker → save.
- **Quiz tab:** number of questions (5/10/15), question types (three checkboxes), "✦ New quiz"
  (1 action); list of past quizzes with best score and Retake.

### 4.3 Taking a quiz (agreed mockup)
- Full screen, one question at a time, progress bar.
- Multiple choice / true-false: marked instantly from the stored answer (no AI call).
- Short answer: type, "Check" → AI marks it with a reason (no allowance; see §6.4).
- Results: score, change since last attempt, list of wrong answers, "Make cards from N wrong
  answers" (deck picker), Retake, Back to note.
- Leaving mid-quiz saves the attempt as unfinished; reopening resumes it. Only finished attempts
  count on Progress.

### 4.4 Recording a lecture (agreed mockup)
1. **Before:** title, course, transcript choice — Live, free (default; disabled with a reason in
   browsers without speech recognition, e.g. Firefox) · Accurate, after recording (shows time
   left this week) · None. Reminder: "Ask your lecturer before recording."
2. **During:** timer, mic level, live transcript text (if chosen), Pause, Stop & save. Warning at
   1h55m, automatic stop at 2h.
3. **Lecture page:** audio player; transcript beside it, timestamped, tap a line to seek, search;
   "✦ Make a note" (1 action; links the note to the lecture); "↻ Get accurate transcript";
   "Delete lecture" (confirm; deletes audio).

## 5. Data model (new migration)

```
lectures         id, user_id, course_id (null; on delete set null), title (1–200),
                 recorded_at, duration_seconds (≥0, ≤7200), audio_path, audio_bytes,
                 transcript jsonb (array of {start, end, text}; seconds),
                 transcript_status ('none'|'live'|'processing'|'done'|'failed'),
                 transcript_source ('browser'|'assemblyai'|null), transcript_job_id,
                 note_id (null; references notes on delete set null), created_at
quizzes          id, user_id, note_id (references notes on delete cascade), title,
                 questions jsonb, created_at
quiz_attempts    id, user_id, quiz_id (on delete cascade), answers jsonb ({question_id:
                 {given, correct, feedback?}}), correct int, total int, started_at, finished_at
ai_usage         + column actions int default 0 (replaces imports; data migrated)
transcription_usage  id, user_id, lecture_id, seconds int, at timestamptz
```

- Question shape (validated on write): `{ id, type: 'mcq'|'true_false'|'short', prompt,
  options?: string[4], answer: string, explanation }`. For `mcq` the answer must be one of the
  options; for `true_false` it is 'true' or 'false'.
- Row-level security: "own rows" on every new table, as in Phase 1.
- **Functions (security definer, fixed limits inside, not parameters):**
  - `ai_actions_left()` → int; `consume_ai_action()` → boolean (limit 20, UTC day).
    `consume_ai_import` is dropped; PDF import uses these.
  - `transcription_seconds_left()` → int over the last 7 days (limit 10800);
    `record_transcription(lecture_id, seconds)` → inserts usage when a job finishes.
  - `mark_short_answer_allowed(attempt_id, question_id)` → boolean: true only if the attempt is
    the caller's, unfinished, the question is `short`, and it hasn't been marked yet.
- **Storage:** bucket `imports` additionally allows `image/jpeg`, `image/png`, `image/webp`.
  New private bucket `lectures` (audio/webm, audio/mp4, audio/ogg; 60 MB per file) with the same
  own-folder policies (`<user id>/<lecture id>.<ext>`).

## 6. Server design

### 6.1 Shared AI helper (`lib/ai/run.ts`)
`runAiAction({ supabase, kind, call })`: verifies the session; returns `limit` if
`ai_actions_left() < 1`; runs `call(client)`; on success calls `consume_ai_action()` and returns
the result; maps failures to `{ error: 'busy' | 'refused' | 'too_long' | 'limit' | 'failed' }`.
Every call uses **structured outputs** (`output_config.format` with a JSON schema) so results
always parse, and every result is re-validated (Zod, added as a direct dependency; MIT) before it
reaches the client. Student text
(notes, transcripts, OCR) is passed as quoted material in the user turn, never as instructions.
`request.signal` is passed through so a cancelled request stops the model.

Known gap (accepted): many simultaneous requests at the last remaining action can each pass the
check; the overshoot is bounded by a student's concurrency. Closing it needs the Supabase service
role key on the server, which we avoid.

### 6.2 Routes (`app/api/ai/...`, each with its own schema and prompt module in `lib/ai/`)

| Route | Input | Output | Model |
|---|---|---|---|
| `POST /api/ai/scan` | storage paths (≤10), target `note`/`cards`/`planner` | note `{title, content_md}` · cards `[{front, back}]` · planner `{tasks[], classes[]}` with `unsure` flags | Sonnet 5.5 |
| `POST /api/ai/flashcards` | note id | `[{front, back}]` (≤40) | Haiku 4.5 |
| `POST /api/ai/summary` | note id | `{summary_md}` (≤150 words) | Haiku 4.5 |
| `POST /api/ai/quiz` | note id, count, types | questions (as §5) | Haiku 4.5 |
| `POST /api/ai/quiz/mark` | attempt id, question id, answer | `{correct, feedback}` | Haiku 4.5 (not charged; gated by `mark_short_answer_allowed`) |
| `POST /api/ai/lecture-note` | lecture id | note `{title, content_md}` | Sonnet 5.5 |
| `POST /api/import/pdf` | (unchanged) | (unchanged) | Sonnet 5.5, now via `runAiAction` |

Notes are read server-side with the student's own session (RLS applies), so a student can only
send their own notes. Scan uploads are deleted after the call, success or not. `maxDuration` is
300 s (Hobby) on scan, PDF import and lecture-note; 60 s elsewhere.

### 6.3 Summary block (`lib/notes/summaryBlock.ts`)
Pure functions `getSummary(md)`, `setSummary(md, summary)`, `removeSummary(md)`. The block is a
blockquote at the start of the document whose first line is `**Summary**`. Applied client-side
through the normal save path, so autosave, conflict handling and undo work as usual.

### 6.4 Quiz marking
Short answers are compared exactly first (case/space-insensitive) — a match is correct with no AI
call. Otherwise `/api/ai/quiz/mark` checks `mark_short_answer_allowed`, asks Haiku to mark against
the stored answer and explanation, and stores the result in the attempt. Each question can be
marked once per attempt, so the free marking can't be reused as a general AI endpoint.

### 6.5 Lectures
- **Recording:** `MediaRecorder`, mono, 32 kbps Opus (`audio/webm`) or AAC (`audio/mp4`, Safari).
  Chunks every 5 s are appended to IndexedDB under a session id; on Stop they're joined and
  uploaded with Supabase's resumable (TUS) upload, then the lecture row is saved and the local
  copy deleted. On load, a leftover local session offers "Recover unsaved recording".
- **Live transcript:** `SpeechRecognition` (continuous, interim results), restarted on `end` while
  recording; final results become `{start, end, text}` lines timed from the recording start.
  Pause stops both recorder and recognition.
- **Accurate transcript:** `POST /api/lectures/[id]/transcribe` checks
  `transcription_seconds_left() ≥ duration`, creates a 2-hour signed URL for the audio, submits it
  to AssemblyAI (`speech_model` Universal-2, no extra add-ons), stores the job id and sets
  `processing`. `GET` on the same route asks AssemblyAI for status; when `completed` it converts
  word/sentence timings into lines, saves them, calls `record_transcription`, and sets `done`;
  `error` → `failed` (nothing recorded). The lecture page polls every 10 s while `processing`, and
  resumes polling on any later visit. No webhook needed.
- **Storage use:** each student has an audio quota of **300 MB** (~20 hours at 32 kbps), the sum
  of their `audio_bytes`. Warning at 80%, recording blocked at 100% with "delete old lectures to
  record more". The quota is one constant. Note: Supabase's free tier gives **1 GB for the whole
  project**, shared by every student's audio and uploads — enough for testing and a handful of
  students. Real use needs Supabase Pro (100 GB included) or a smaller quota.

### 6.6 Secrets
Server-only env vars: `ANTHROPIC_API_KEY` (existing) and `ASSEMBLYAI_API_KEY` (new). Without
`ASSEMBLYAI_API_KEY`, "Accurate" is hidden and the rest works. Without `ANTHROPIC_API_KEY`, AI
buttons explain that AI isn't set up (PDF import keeps its plain-text fallback).

## 7. Errors (student-facing)

| Situation | What the student sees | Charged? |
|---|---|---|
| Out of AI actions | Buttons disabled: "You've used today's 20 AI actions. They reset in 3h 12m." | — |
| Out of transcription time | "Accurate" disabled with time until enough frees up; live/none still available | — |
| AI busy / overloaded / network | "Couldn't reach the AI. Try again." + Retry | No |
| Model refused or unreadable pages | "Couldn't read these pages. Try clearer photos." | No |
| Output cut off (max tokens) | Result shown with "This may be incomplete" | Yes |
| Quiz with <3 valid questions | "Couldn't make a good quiz from this note." | No |
| Too many / too large / wrong files | Caught before upload with the specific limit | — |
| Microphone denied | Tip on allowing the microphone for this site | — |
| Upload failed | Audio kept locally; "Retry upload" | — |
| AssemblyAI job failed | Lecture shows "Transcript failed" + Retry; live transcript kept | No |
| Storage nearly full / full | Warning / recording blocked with how to free space | — |

## 8. Testing (TDD throughout)

- **Unit (Vitest):** `runAiAction` with a fake client (limit, charge-on-success, error mapping,
  abort); each result schema and validator (drops an MCQ whose answer isn't an option; rejects
  <3 questions); summary block functions; course matching for scanned classes; transcript line
  conversion from AssemblyAI timings; live-transcript timing; storage-use thresholds; review
  screens, Study panel, quiz player (resume, scoring, wrong → cards), recorder controls with a
  fake `MediaRecorder`/`SpeechRecognition`.
- **DB (Vitest, local Supabase):** RLS on new tables; `consume_ai_action` stops at 20;
  transcription limit over a rolling week; `mark_short_answer_allowed` once per question, only
  for own unfinished attempts; deleting a note deletes its quizzes; bucket policies.
- **E2E (Playwright, desktop + Pixel 7):** with the AI and AssemblyAI replaced by local stand-in
  routes (env flag, test-only): scan → review → save for each target; flashcards and quiz from a
  note, retake, wrong → cards; summary add/replace/remove; record with Chromium's fake
  microphone, stop, play back, seek from transcript; limit reached.
- **Real-AI smoke set (manual, opt-in):** a sample photo, handwriting sample, PDF, note and short
  audio clip, run against the real APIs only when invoked, to spot-check quality before deploys.

## 9. Security and privacy

- All AI and transcription keys stay server-side; no `NEXT_PUBLIC_` secrets.
- Every route reads data with the student's own session, so RLS limits it to their rows; storage
  paths are checked to start with the caller's user id.
- Scan uploads are deleted after processing; lecture audio is deleted with the lecture.
- AssemblyAI receives a short-lived signed URL, not a permanent link.
- Recording shows a consent reminder; the app never records without the student pressing Start.

## 10. Costs (for the app owner)

Approximate, at current list prices: Haiku actions ~1–3¢, Sonnet actions ~3–8¢, accurate
transcription $0.15 per audio hour. Worst case per student (20 actions/day, 3 h/week) ≈ 15–40¢
a day; typical use a few cents a day. Storage: free up to 1 GB per project; beyond that Supabase
Pro (100 GB included) is the next step.

## 11. Build order

1. Shared AI helper, `ai_usage.actions`, allowance display; move PDF import onto it (Sonnet).
2. Summary + flashcards from a note (Study panel, Summary and Cards tabs).
3. Quizzes: tables, generation, player, marking, results, wrong → cards, Progress chart.
4. Scan: uploads, route, three review screens (note, cards, planner with course matching).
5. Lectures: recorder + recovery, live transcript, upload, lecture page with playback.
6. Accurate transcripts (AssemblyAI) and lecture → note.

Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 12. Out of scope (Phase 2)

Paid plans and billing; exam mode (answers hidden until the end); spaced repetition of quiz
questions; speaker labels and multi-language transcripts; video recording; sharing lectures or
quizzes; offline AI; the AI tutor chat and study scheduling (Phase 3); recommended videos and
resources (Phase 4).
