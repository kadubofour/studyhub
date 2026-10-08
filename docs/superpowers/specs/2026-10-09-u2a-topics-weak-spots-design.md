# U2a: Topics and weak spots

First of three U2 builds (U2a topics and weak spots, U2b the study plan, U2c Home and tutor tie-ins).
U2a is the foundation: it gives each course a list of topics, links the student's material to them, and
says from their own results which topics are strong and which are weak. It plans nothing yet.

## 1. Goal

For each course a student can see a list of topics (for example Glycolysis, Krebs cycle, Electron
transport), each marked Not started, Covered, Weak or Mastered, with the numbers behind the label, and a
short "Weak spots" box saying what to revise first. The topic list is drafted by AI from the course's notes
and lecture transcripts, and the student edits it. Success: from a course with a few notes and lectures, a
student drafts topics in one tap, fixes them, saves, answers some quiz questions and reviews some cards,
and then sees which topics are weak, with the evidence.

## 2. Decisions made

| Question | Decision |
|---|---|
| How topics are created | AI drafts them from the course's notes and lectures; the student edits and approves. Nothing is saved until Save |
| How material links to topics | AI links notes and lectures when it drafts. Flashcards and quiz questions inherit from their source note. A deck can be assigned to a topic by hand |
| What "mastered" means | By results: answers in the last 30 days. Mastered is 10 or more answers and 80% or more right; Weak is 5 or more answers and under 60% right |
| Where it lives | A "Topics" section inside Progress, with a course picker. No new sidebar item |
| Cost | Drafting or updating topics is 1 AI action. Everything else is free |
| Not in this build | The study plan and its modes (Sprint, Balanced, Deep dive), the Warm-up check, Home suggestions, a "Practice this" button, the tutor as a signal |

## 3. Data

New migration `20261016000000_topics.sql`.

- `topics`: `id`, `user_id`, `course_id` (required, deleting the course deletes its topics), `name` (1 to 80
  characters), `position` (order in the list), `created_at`. At most 40 topics per course. Names are
  unique within a course, ignoring case.
- `topic_links`: `id`, `user_id`, `topic_id` (deleting the topic deletes its links), and exactly one of
  `note_id`, `lecture_id`, `deck_id` (a check enforces "exactly one"; deleting the note, lecture or deck
  deletes its link). A target can be linked to several topics, and once to the same topic.
- `cards.note_id` (new, optional): the note a card was made from; deleting the note sets it to null.
  Existing cards stay null.
- Row-level security: a student reads and writes only their own rows. A topic's course, and a link's topic
  and target, must be the student's own (helper functions as for tutor chats; a missing `owns_deck` is
  added). A link's target must belong to the same course as its topic.
- `save_course_topics(p_course uuid, p_topics jsonb) returns void` (security invoker, so row-level security
  applies): takes the whole edited list as `[{ id?, name, links: [{ kind: 'note'|'lecture'|'deck', id }] }]`
  and makes the course match it in one transaction: topics with an `id` are renamed and reordered, topics
  without one are created, topics missing from the list are deleted, and each topic's links are replaced.
  Any invalid input (duplicate names, over 40 topics, a link to something not in the course) fails the whole
  call and changes nothing.
- `topic_stats(p_course uuid)` (security invoker): see section 5.

Where `cards.note_id` is set (through an optional `noteId` argument of `createCards`): the Cards tab in the
note's study panel, the "wrong answers to cards" button on quiz results (the quiz's note), and the tutor's
flashcards proposal when the chat is about a note. Scan and manual cards leave it null.

## 4. Drafting topics

`POST /api/ai/topics` with `{ courseId, mode: 'draft' | 'update' }`. It reads the course's notes and
lectures with the student's own session, so only their material is used.

- **Input:** for each of the course's newest 60 notes and lectures, its title and the first 1,500
  characters (a lecture's transcript text), inside tags so it is read as material and not as instructions,
  with a total cap of 40,000 characters.
- **Draft:** the model returns 5 to 20 topics, each with the ids of the notes and lectures that cover it
  (structured output, validated again with Zod; ids not in the input are dropped; empty or duplicate
  names are dropped). Fewer than 2 notes or lectures with real text gives `too_little` before any AI call
  and no charge.
- **Update:** the existing topic list and links are also sent. The model may only add new topics and new
  links for material that is not linked yet; it never renames, merges, removes or re-links existing ones.
- **Cost:** 1 AI action through `runAiAction` (daily limit, fair use, speed limit and release on failure as
  for the other AI routes). Model: the light model.
- The route returns the draft; it does not save it. The browser shows it in the editor (section 6) and the
  student saves with `save_course_topics`.

## 5. Scoring

`topic_stats(p_course)` returns one row per topic of the course, computed from the student's data each
time, so it is never out of date:

- **Answers** are counted per topic, over a window of the last 30 days:
  - quiz answers: each answer in an attempt finished in the window, counted as right if its `correct` is
    true; a quiz belongs to the topics its note is linked to;
  - card reviews: each review in the window, counted as right if its rating is 3 or 4 (Good, Easy); a card
    belongs to the topics its note is linked to, plus the topic its deck is linked to.
  - An answer counts once for each topic it belongs to.
- **Per topic it returns:** `answers_30d`, `correct_30d`, `answers_all` (all time), `last_practised`,
  `notes`, `lectures` and `decks` (counts of linked items), and `status`:
  1. `mastered`: `answers_30d` is 10 or more and 80% or more are right;
  2. `weak`: `answers_30d` is 5 or more and under 60% are right;
  3. `covered`: any answers ever;
  4. `not_started`: otherwise.
- **Weak spots box** (done in the browser from these rows): weak topics worst first, then covered topics not
  practised for 14 days or more, oldest first; at most 5.
- The thresholds (30 days, 10, 80%, 5, 60%, 14 days) live as constants in `lib/topics/status.ts`; a test
  reads the SQL and checks they agree, as the billing constants are checked.

## 6. The screen

**Progress, new "Topics" section** (below what Progress shows now):

- A course picker (the first course by default; courses with no topics are listed too).
- A course with no topics: a short explanation and a **Draft topics** button (1 AI action). A course whose
  notes or lectures are not linked to any topic, or that has new material since, shows **Update topics**.
- A course with topics: the "Weak spots" box (hidden when there is nothing to say; "Nothing weak right now"
  when topics exist and none are weak), a progress line ("3 of 8 mastered, 5 covered"), and the topic list.
  Each row: the name, a status chip (Not started, Covered, Weak, Mastered), the numbers behind it
  ("12 answers, 67% right in the last 30 days" or "Not practised yet"), and "N notes, N lectures, N decks".
- **Edit topics:** switches the list into an editor: rename, reorder (move up and down), delete, add a topic,
  merge two topics (the merged topic keeps the links of both), and for each topic add or remove linked notes,
  lectures and decks from pickers that list this course's items. **Save** writes everything at once;
  **Cancel** discards. A draft from the AI opens in the same editor, marked as unsaved, so nothing is
  saved until the student presses Save.
- The statuses are words and an icon, never colour alone.

## 7. Errors and edge cases

| Situation | What the student sees |
|---|---|
| Too little material (under 2 notes or lectures with text) | "Add a few more notes or record a lecture first." No charge |
| AI unavailable, daily limit, fair use, speed limit | The existing messages and upgrade prompt |
| The AI returns nothing usable | "Couldn't find topics in this material." The AI action is given back |
| Save fails | "Couldn't save." The edits stay on screen; try again |
| Two names the same, or 41 topics | Caught in the editor before Save, with a plain message |
| A linked note, lecture or deck is deleted | Its link disappears; the topic stays |
| A course is deleted | Its topics and links go with it |
| A student with no quiz or card activity | Every topic shows Not started; no weak spots |

## 8. Out of scope

The study plan, its modes (Sprint, Balanced, Deep dive) and the Warm-up check (U2b); Home suggestions, a
"Practice this" button and the tutor knowing weak topics (U2c); tagging individual cards or quiz questions
with AI; topics across courses; sharing topics.

## 9. Testing

- **DB:** privacy of both tables; a link must point at the student's own item in the same course; "exactly
  one target"; the 40-topic and unique-name limits; `save_course_topics` renames, creates, deletes and
  replaces links in one go and changes nothing when any part is invalid; deleting a note, deck or course
  tidies the links; `topic_stats` with known quiz answers and card reviews gives the exact counts and
  statuses (including the 30-day window edges, an answer counting for two topics, and a deck-level link).
- **Unit:** the drafting prompt builder (caps, tags, newest first), validation of the AI's reply (unknown
  ids, duplicate names, 5 to 20), update mode only adds, the route (limits, release on failure,
  too-little, not signed in, not the student's course), the status constants agree with the SQL, the
  weak-spot ordering, the editor (rename, reorder, merge, delete, add, link and unlink, validation, save
  and cancel), the Progress section (empty state, draft flow, statuses with numbers).
- **E2E (fake AI):** draft topics from two notes, edit one name, save, reload and still see them; answer a
  quiz wrongly and see a topic turn weak with its numbers; Update topics adds only what is new.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 10. Build order

1. Migration, `save_course_topics`, `topic_stats`, `cards.note_id` and the `createCards` argument, with DB
   tests.
2. Status constants, the weak-spot ordering and the data functions.
3. The drafting route.
4. The Topics section on Progress (list, statuses, weak spots box).
5. The editor, draft and update flows.
6. E2E and a look at it on desktop and phone width in Classic and Paper.
