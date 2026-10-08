# Phase 3A: AI tutor chat

Part of Phase 3 (AI tutor chat and study scheduling). Study scheduling is 3B and gets its own spec.

## 1. Goal

A student can chat with an AI tutor that starts from their own notes, lecture transcripts and
flashcards, and can go beyond them when asked. Success: from a note or lecture, one click opens a
chat that answers about that item; from the Tutor page, a free-standing chat finds the relevant
material on its own; replies show what they drew on and can be saved as a note, flashcards or a quiz.

## 2. Decisions made

| Question | Decision |
|---|---|
| What the tutor does | Both: grounded in the student's material, and general knowledge when asked |
| Where it lives | A Tutor page with saved chats, plus an "Ask the tutor" button on notes and lectures |
| Limits | Free: 20 tutor messages a day, separate from the 10 AI actions. Premium: counts toward the 400 a month fair use, 1 per message |
| Actions in chat | Buttons on replies (Save as note, Make flashcards, Quiz me on this). The tutor does not create things on its own |
| Finding material | The attached item in full, plus Postgres full-text search. No embeddings |

## 3. Data

- `tutor_chats`: `id`, `user_id`, `title`, `course_id` (nullable), `note_id` (nullable), `lecture_id`
  (nullable), `created_at`, `updated_at`. At most one of `note_id` and `lecture_id` is set.
  Deleting a note, lecture or course sets the link to null; the chat stays.
- `tutor_messages`: `id`, `chat_id`, `user_id`, `role` (`user` | `assistant`), `content`, `sources`
  (jsonb list of `{kind: 'note'|'lecture'|'card', id, title}`), `status` (`ok` | `cut_off`), `created_at`.
- Row-level security on both tables: a student reads and writes only their own rows, and a message's
  chat must be theirs. Deleting a chat deletes its messages.
- Full-text search: a generated `tsvector` column and GIN index on notes (title and text), lecture
  transcripts, and flashcards (front and back). Search is always filtered to the signed-in student.
- Usage: a per-day tutor message count per student, kept next to the existing AI usage and written only
  with the service role.

## 4. Pages

- **Tutor** (sidebar entry and tab-bar slot): a list of chats (title, course tag, last activity) and a
  New chat button. Opening a chat shows the conversation with a message box at the bottom.
- **Chat**: messages in order; the assistant's reply streams in. Math and formatting render as in notes.
  Under each assistant reply: the sources it used (links to the note or lecture) and three buttons.
- **Ask the tutor** button on the note page and the lecture page. It opens the chat already attached to
  that item, or the existing one if there is one. The chat header names the item it is attached to.
- A chat can be renamed, moved to another course, and deleted (after confirming).
- Settings shows "Tutor messages today: n of 20" for Free students.

## 5. How it answers

`POST /api/ai/tutor` takes `{ chatId, message }` and streams the reply.

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

## 6. Limits

- Speed limit: 10 requests a minute for everyone, as for other AI features.
- Free: 20 tutor messages a day (UTC day). Premium: no daily limit; each message counts 1 toward the
  400 a month fair use.
- `tutor_check` reserves a message before the call and `tutor_release` gives it back if the call fails,
  as `ai_check` / `ai_release` do, so parallel requests cannot overshoot. Both run with the service role.
- The action buttons use the existing flashcard and quiz generators and cost what those already cost.
  Save as note is free.

## 7. Errors

| Situation | What the student sees |
|---|---|
| No OpenAI key or credit used up | "AI isn't available right now. Try again later." |
| Free daily tutor limit | "You've used today's 20 tutor messages." with an upgrade link |
| Premium fair use reached | The existing fair-use message |
| Speed limit | "Slow down a little and try again." |
| Stream drops | The partial reply stays with "Reply was cut off. Try again." |
| Material too long | It is trimmed; the chat still works |

The student's message is saved before the call, so it is never lost.

## 8. Out of scope

The tutor creating notes, cards or planner items on its own (3B); semantic search with embeddings;
voice or image input; sharing chats; chat export.

## 9. Testing

- Unit: the context builder (caps, order, attached item first, other items excluded), source list,
  trimming, the prompt tags, limit-code to message mapping.
- DB: row-level security on both tables; full-text search returns only the student's own material;
  the 20-a-day allowance; parallel messages cannot overshoot; a failed call gives its message back;
  Premium counts toward fair use; deleting a note leaves the chat.
- E2E (fake OpenAI): ask a question from a note, see the streamed reply and its sources; free-standing
  chat; Save as note creates a note in the course; hitting the daily limit shows the message.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 10. Build order

1. Tables, search columns, `tutor_find_material`, limit functions, with DB tests.
2. Context builder and `/api/ai/tutor` streaming route.
3. Tutor page and chat view.
4. Ask the tutor buttons on notes and lectures.
5. Reply buttons (Save as note, Make flashcards, Quiz me on this).
6. Settings count and E2E.
