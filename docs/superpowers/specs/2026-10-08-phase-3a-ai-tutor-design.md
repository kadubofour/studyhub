# Phase 3A: AI tutor agent

Part of Phase 3 (AI tutor chat and study scheduling). Study scheduling is 3B and gets its own spec.
The tutor is an agent: it can propose notes, flashcards, quizzes and tasks, and the student approves each one.

## 1. Goal

A student can chat with an AI tutor that starts from their own notes, lecture transcripts and
flashcards, and can go beyond them when asked. Success: from a note or lecture, one click opens a
chat that answers about that item; from the Tutor page, a free-standing chat finds the relevant
material on its own; replies show what they drew on; and when the student asks ("make me flashcards on this"), the tutor shows a preview of what it would create and nothing is saved until the student approves it.

## 2. Decisions made

| Question | Decision |
|---|---|
| What the tutor does | Both: grounded in the student's material, and general knowledge when asked |
| Where it lives | A Tutor page with saved chats, plus an "Ask the tutor" button on notes and lectures |
| Limits | Free: 20 tutor messages a day, separate from the 10 AI actions. Premium: counts toward the 400 a month fair use, 1 per message |
| Actions in chat | Full agent: the tutor can propose a note, flashcards, a quiz or a task. Each proposal is a preview card with Add and Discard; nothing is saved until the student taps Add |
| Finding material | The attached item in full, plus Postgres full-text search. No embeddings |

## 3. Data

- `tutor_chats`: `id`, `user_id`, `title`, `course_id` (nullable), `note_id` (nullable), `lecture_id`
  (nullable), `created_at`, `updated_at`. At most one of `note_id` and `lecture_id` is set.
  Deleting a note, lecture or course sets the link to null; the chat stays.
- `tutor_messages`: `id`, `chat_id`, `user_id`, `role` (`user` | `assistant`), `content`, `sources`
  (jsonb list of `{kind: 'note'|'lecture'|'card', id, title}`), `proposals` (jsonb list, see section 6), `status` (`ok` | `cut_off`), `created_at`.
- Row-level security on both tables: a student reads and writes only their own rows, and a message's
  chat must be theirs. Deleting a chat deletes its messages.
- Full-text search: `tutor_find_material` searches notes (title and text), lecture transcripts and
  flashcards (front and back), computed at query time (lecture transcripts are jsonb and cannot be a
  generated column, and one student has few rows). It runs as the student, so it only sees their own.
  Indexes can be added later without changing anything else.
- Usage: tutor messages are rows in `ai_charges` with `kind = 'tutor'` (AI actions are `kind = 'action'`),
  written only with the service role. The Free daily 10 counts actions only; Premium fair use counts both.

## 4. Pages

- **Tutor** (sidebar entry and tab-bar slot): a list of chats (title, course tag, last activity) and a
  New chat button. Opening a chat shows the conversation with a message box at the bottom.
- **Chat**: messages in order; the assistant's reply streams in. Math and formatting render as in notes.
  Under each assistant reply: the sources it used (links to the note or lecture), and any proposals
  as preview cards (section 6).
- **Ask the tutor** button on the note page and the lecture page. It opens the chat already attached to
  that item, or the existing one if there is one. The chat header names the item it is attached to.
- A chat can be renamed, moved to another course, and deleted (after confirming).
- Settings shows "Tutor messages today: n of 20" for Free students.

## 5. How it answers

`POST /api/ai/tutor` takes `{ chatId, message }` and streams the reply (one JSON object per line).

1. Check the plan limits (section 6). Refuse with a clear error before calling OpenAI if over.
2. Save the student's message.
3. Build the context, in this order, within a size cap:
   - the attached note or lecture transcript, trimmed to its first part if it is very long;
   - the best full-text matches for the message across the student's own notes, transcripts and
     flashcards (top few, trimmed), excluding the attached item;
   - the last several messages of the chat.
4. Call the model with the instructions below and stream the answer.
5. Save the assistant message with its sources. If the stream breaks, keep the partial text with
   `status = 'cut_off'`.

Instructions to the model: prefer the student's own material and say which of it was used; if the
material does not cover the question, answer from general knowledge and say so; explain step by step
and check understanding; do not invent what the student's notes say. Student text and material go
inside tags (`lib/ai/input.ts`), so they are read as material, not instructions.

Model: the strong model for replies. Retrieval is one Postgres function,
`tutor_find_material(query, limit)`, so semantic search can replace it later without other changes.

## 6. Agent actions (proposals)

The model is given four tools. A tool call never saves anything: it becomes a **proposal** stored on the
assistant message and shown as a preview card with **Add** and **Discard**. The content is written by the
model in the tool call, so approving costs no further AI call.

| Tool | Arguments | On Add |
|---|---|---|
| `create_note` | `title`, `body` (markdown), `course_id?` | `createNote` in the chat's course |
| `create_flashcards` | `deck` (existing deck id or a new name), `cards[{front, back}]` (max 30) | `createDeck` if new, then `createCards` |
| `create_quiz` | `title`, `questions[]` in the existing quiz format, `note_id` | saves a quiz on that note. Only offered when the chat is attached to a note (quizzes belong to a note); otherwise the tutor offers to make the note first |
| `create_task` | `title`, `type`, `due_at?`, `priority?`, `course_id?` | `createTask` |

- The student can edit a card or the note title in the preview before adding. Discard marks the
  proposal discarded. Each proposal has a state (`pending`, `added` with the new item's id, `discarded`)
  stored on the message, so a reload shows what was done and an added item is a link.
- Add runs in the student's browser with their own session, through the existing data functions, so
  row-level security applies exactly as it does for anything they create by hand.
- A tool call with invalid arguments (empty title, no cards, too many cards, a course or deck that is not
  theirs) is dropped; the reply says the tutor could not prepare it. A proposal is never half-saved:
  Add either creates all of it or none, and reports failure.
- The tutor never edits or deletes existing items, and never acts without the Add tap.

## 7. Limits

- Speed limit: 10 requests a minute for everyone, as for other AI features.
- Free: 20 tutor messages a day (UTC day). Premium: no daily limit; each message counts 1 toward the
  400 a month fair use.
- `tutor_check` reserves a message before the call and `tutor_release` gives it back if the call fails,
  as `ai_check` / `ai_release` do, so parallel requests cannot overshoot. Both run with the service role.
- Proposals are part of the same message: a message that proposes things still counts 1. Adding is free.

## 8. Errors

| Situation | What the student sees |
|---|---|
| No OpenAI key or credit used up | "AI isn't available right now. Try again later." |
| Free daily tutor limit | "You've used today's 20 tutor messages." with an upgrade link |
| Premium fair use reached | The existing fair-use message |
| Speed limit | "Slow down a little and try again." |
| Stream drops | The partial reply stays with "Reply was cut off. Try again." |
| Material too long | It is trimmed; the chat still works |

The student's message is saved before the call, so it is never lost.

## 9. Out of scope

The tutor acting without approval, editing or deleting existing items, and building a study plan or schedule (3B); semantic search with embeddings;
voice or image input; sharing chats; chat export.

## 10. Testing

- Unit: the context builder (caps, order, attached item first, other items excluded), source list,
  trimming, the prompt tags, limit-code to message mapping; the tool-argument validation for all four
  tools (empty, oversize, someone else's course or deck, quiz with no note); proposal state changes.
- DB: row-level security on both tables; full-text search returns only the student's own material;
  the 20-a-day allowance; parallel messages cannot overshoot; a failed call gives its message back;
  Premium counts toward fair use; deleting a note leaves the chat.
- E2E (fake OpenAI): ask a question from a note, see the streamed reply and its sources; free-standing
  chat; ask for flashcards, see the preview, edit one card, Add, and find the cards in the deck; Discard
  saves nothing; a proposal survives a reload; hitting the daily limit shows the message.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 11. Build order

1. Tables, search columns, `tutor_find_material`, limit functions, with DB tests.
2. Context builder and `/api/ai/tutor` streaming route.
3. Tutor page and chat view.
4. Ask the tutor buttons on notes and lectures.
5. Agent tools: the four tools, proposals on messages, preview cards, Add and Discard.
6. Settings count and E2E.
