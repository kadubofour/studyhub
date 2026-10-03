# Studyhub — Phase 2 (Scan, AI study tools, Lectures) Design

Date: 2026-10-03
Status: Draft — awaiting review
Builds on: `2026-10-01-study-hub-core-design.md` (Phase 1) and the AI PDF import added after it.
AI provider: **OpenAI for everything** (text, images, PDFs, transcription), replacing Claude and AssemblyAI so there is one account, key and bill.

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
| Lecture transcription | Default: free live transcript (browser speech recognition). Opt-in: accurate transcript from OpenAI. Or record only. |
| Lecture audio | Kept, with playback and tap-a-line-to-seek. |
| Plans/billing | None. Everyone gets everything; limits live in one place so plans can be added later. |
| Models (OpenAI) | GPT-6 Luna (`gpt-6-luna`, $0.10/$0.50 per M tokens) for flashcards, summaries, quizzes, quiz marking. GPT-6.1 Sol (`gpt-6.1-sol`, $2/$10) for scans, PDF import (moved from Claude Opus 5.5) and lecture notes. Model names are constants in one file. |
| Limits | 20 AI actions per student per UTC day (every AI call except quiz marking). Big jobs cost by size: PDF import and scans use 1 action per 10 pages (rounded up; a 100-page PDF uses 10), turning a lecture into a note uses 2, everything else 1. 3 hours of accurate transcription per rolling 7 days, max 2 hours per lecture. Recording and live transcripts are unlimited. |
| Charging | Check before, count only after success. Failed or cancelled work is free. |
| Transcription | OpenAI `whisper-1` ($0.006/min, about $0.36/hr): the OpenAI model that returns segment timestamps, which tap-to-seek needs. OpenAI accepts at most 25 MB per file and has no async mode, so recordings are saved in parts of up to 20 minutes and transcribed part by part. (Considered: AssemblyAI at $0.15/hr with async jobs; cheaper, but a second account.) |

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
   "✦ Scan N pages · uses 1 AI action" (scans are at most 10 pages, so always 1).
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
   "✦ Make a note" (2 actions; links the note to the lecture); "↻ Get accurate transcript"
   (progress "part 2 of 3");
   "Delete lecture" (confirm; deletes audio).

## 5. Data model (new migration)

```
lectures         id, user_id, course_id (null; on delete set null), title (1–200),
                 recorded_at, duration_seconds (≥0, ≤7200), audio_bytes,
                 parts jsonb (array of {path, start, duration, transcribed}; ≤20 min each),
                 transcript jsonb (array of {start, end, text}; seconds from lecture start),
                 transcript_status ('none'|'live'|'processing'|'done'|'failed'),
                 transcript_source ('browser'|'openai'|null),
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
  - `ai_actions_left()` → int; `consume_ai_action(p_cost int default 1)` → boolean (cost 1–10;
    false, and nothing counted, if it would take the day past 20; UTC day).
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
`runAiAction({ supabase, call, cost })`: verifies the session; returns `limit` if
`ai_actions_left() < cost`; runs `call(client)`; on success calls `consume_ai_action(cost)` and returns
the result; maps failures to `{ error: 'busy' | 'refused' | 'too_long' | 'limit' | 'failed' }`.
Every call uses OpenAI's Responses API with **structured outputs** (a strict JSON schema; exact
parameter names taken from OpenAI's docs at implementation time) so results always parse, and every result is re-validated (Zod, added as a direct dependency; MIT) before it
reaches the client. Student text
(notes, transcripts, OCR) is passed as quoted material in the user turn, never as instructions.
`request.signal` is passed through so a cancelled request stops the model. A structured-output
refusal maps to `refused`. Uses the official `openai` npm package (Apache-2.0); the Anthropic SDK
is removed once PDF import has moved.

Known gap (accepted): many simultaneous requests at the last remaining action can each pass the
check; the overshoot is bounded by a student's concurrency. Closing it needs the Supabase service
role key on the server, which we avoid.

### 6.2 Routes (`app/api/ai/...`, each with its own schema and prompt module in `lib/ai/`)

| Route | Input | Output | Model |
|---|---|---|---|
| `POST /api/ai/scan` | storage paths (≤10), target `note`/`cards`/`planner` | note `{title, content_md}` · cards `[{front, back}]` · planner `{tasks[], classes[]}` with `unsure` flags | Sol |
| `POST /api/ai/flashcards` | note id | `[{front, back}]` (≤40) | Luna |
| `POST /api/ai/summary` | note id | `{summary_md}` (≤150 words) | Luna |
| `POST /api/ai/quiz` | note id, count, types | questions (as §5) | Luna |
| `POST /api/ai/quiz/mark` | attempt id, question id, answer | `{correct, feedback}` | Luna (not charged; gated by `mark_short_answer_allowed`) |
| `POST /api/ai/lecture-note` | lecture id | note `{title, content_md}` | Sol |
| `POST /api/import/pdf` | (unchanged) | (unchanged) | Sol (was Claude Opus), now via `runAiAction` |

Notes are read server-side with the student's own session (RLS applies), so a student can only
send their own notes. Scan uploads are deleted after the call, success or not. PDFs go to OpenAI as file input (up to 50 MB per
request; the app's own 24 MB / 100-page limits stay). `maxDuration` is
300 s (Hobby) on scan, PDF import and lecture-note; 60 s elsewhere.

### 6.3 Summary block (`lib/notes/summaryBlock.ts`)
Pure functions `getSummary(md)`, `setSummary(md, summary)`, `removeSummary(md)`. The block is a
blockquote at the start of the document whose first line is `**Summary**`. Applied client-side
through the normal save path, so autosave, conflict handling and undo work as usual.

### 6.4 Quiz marking
Short answers are compared exactly first (case/space-insensitive) — a match is correct with no AI
call. Otherwise `/api/ai/quiz/mark` checks `mark_short_answer_allowed`, asks Luna to mark against
the stored answer and explanation, and stores the result in the attempt. Each question can be
marked once per attempt, so the free marking can't be reused as a general AI endpoint.

### 6.5 Lectures
- **Recording:** `MediaRecorder`, mono, 32 kbps Opus (`audio/webm`) or AAC (`audio/mp4`, Safari).
  Every 20 minutes the recorder is restarted so each **part** is a complete file (~5 MB, well under
  OpenAI's 25 MB). Chunks every 5 s are appended to IndexedDB under a session id; each finished
  part is uploaded (Supabase resumable/TUS upload) while recording continues, and the last on
  Stop; then the lecture row is saved and the local copy deleted. On load, a leftover local
  session offers "Recover unsaved recording".
- **Playback across parts:** one player for the whole lecture. It maps a lecture time to (part,
  offset), switches files at part boundaries, and preloads the next part so playback doesn't gap.
- **Live transcript:** `SpeechRecognition` (continuous, interim results), restarted on `end` while
  recording; final results become `{start, end, text}` lines timed from the recording start.
  Pause stops both recorder and recognition.
- **Accurate transcript:** the lecture page checks `transcription_seconds_left() ≥ duration`,
  sets `processing`, then calls `POST /api/lectures/[id]/transcribe?part=N` once per
  untranscribed part, in order. Each call downloads that part from storage (server-side, with the
  student's own session), sends it to OpenAI `whisper-1` with `response_format=verbose_json` and
  segment timestamps, shifts the segment times by the part's start, merges them into the
  transcript, marks the part `transcribed`, and calls `record_transcription(lecture_id,
  part.duration)`. One part (up to 20 min) fits comfortably in the 300 s limit. When every part is
  done → `done`; a failed part → `failed` with Retry, which resumes from that part (finished
  parts are kept and not charged again). Leaving the page pauses; the next visit offers to
  resume. No background jobs or webhooks.
- **Storage use:** each student has an audio quota of **300 MB** (~20 hours at 32 kbps), the sum
  of their `audio_bytes`. Warning at 80%, recording blocked at 100% with "delete old lectures to
  record more". The quota is one constant. Note: Supabase's free tier gives **1 GB for the whole
  project**, shared by every student's audio and uploads — enough for testing and a handful of
  students. Real use needs Supabase Pro (100 GB included) or a smaller quota.

### 6.6 Secrets
One server-only env var: `OPENAI_API_KEY` (new). `ANTHROPIC_API_KEY` is no longer used and can
be removed from Vercel once PDF import has moved. Without `OPENAI_API_KEY`, AI buttons and
"Accurate" transcripts explain that AI isn't set up; recording, live transcripts and PDF import's
plain-text fallback keep working.

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
| A transcription part failed | "Transcript failed" + Retry (resumes from that part); live transcript kept until the accurate one completes | Only finished parts |
| Storage nearly full / full | Warning / recording blocked with how to free space | — |

## 8. Testing (TDD throughout)

- **Unit (Vitest):** `runAiAction` with a fake OpenAI client (limit, charge-on-success, error mapping,
  abort); each result schema and validator (drops an MCQ whose answer isn't an option; rejects
  <3 questions); summary block functions; course matching for scanned classes; merging per-part
  `whisper-1` segments with part offsets; player time to (part, offset) mapping; live-transcript timing; storage-use thresholds; review
  screens, Study panel, quiz player (resume, scoring, wrong → cards), recorder controls with a
  fake `MediaRecorder`/`SpeechRecognition`.
- **DB (Vitest, local Supabase):** RLS on new tables; `consume_ai_action` stops at 20, counts its
  cost, and rejects costs outside 1–10;
  transcription limit over a rolling week; `mark_short_answer_allowed` once per question, only
  for own unfinished attempts; deleting a note deletes its quizzes; bucket policies.
- **E2E (Playwright, desktop + Pixel 7):** with OpenAI replaced by local stand-in
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
- Audio parts are sent to OpenAI by the server only for an accurate transcript the student
  asked for. OpenAI's API data-use terms apply; the recording screen links to them.
- Recording shows a consent reminder; the app never records without the student pressing Start.

## 10. Costs (for the app owner)

Approximate, at OpenAI's list prices; token counts are estimates and reasoning tokens bill as
output, so treat these as ranges.

| Action | Model | Typical | Largest allowed |
|---|---|---|---|
| Summary / flashcards / quiz | Luna | ~0.2–0.3¢ | ~0.5¢ |
| Short-answer marking | Luna | ~0.02¢ (≤60/day) | ~1¢/day |
| Scan | Sol | ~3–5¢ (3 pages) | ~7¢ (10 pages) |
| PDF import | Sol | ~10¢ (10 pages) | ~70¢ (100 pages, = 10 actions) |
| Lecture → note | Sol | ~8¢ (1 h) | ~13¢ (2 h, = 2 actions) |
| Accurate transcript | whisper-1 | 36¢ per hour | 3 h/week ≈ 15¢/day |

Per student per day: light use ≈ 5–15¢; heavy but realistic ≈ $2; worst case with size-based
charging ≈ $1.50–2 (without it, 20 × 100-page PDFs would be ≈ $14). Storage: free up to 1 GB per project; beyond that Supabase
Pro (100 GB included) is the next step.

## 11. Build order

1. OpenAI SDK and shared AI helper, `ai_usage.actions`, allowance display; move PDF import
   onto it (Sol) and remove the Anthropic SDK.
2. Summary + flashcards from a note (Study panel, Summary and Cards tabs).
3. Quizzes: tables, generation, player, marking, results, wrong → cards, Progress chart.
4. Scan: uploads, route, three review screens (note, cards, planner with course matching).
5. Lectures: recorder + recovery, live transcript, upload, lecture page with playback.
6. Accurate transcripts (OpenAI `whisper-1`, part by part) and lecture → note.

Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 12. Out of scope (Phase 2)

Paid plans and billing; exam mode (answers hidden until the end); spaced repetition of quiz
questions; speaker labels and multi-language transcripts; video recording; sharing lectures or
quizzes; offline AI; the AI tutor chat and study scheduling (Phase 3); recommended videos and
resources (Phase 4).
