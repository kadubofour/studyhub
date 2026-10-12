# Course page

Today a course is only a coloured tag: its notes, decks, lectures, topics and exam live on five different pages. The course page is one study space per course, so a student opens "Biology" and sees everything for it together.

## 1. Goal
One page per course at `/courses/[id]` showing what the student has in it, how they are doing on its topics, when the next exam is, and one-tap ways to study it.

Success: from Library (or Progress) a student opens Biology, sees "4 notes · 2 decks · 3 lectures", 12 cards due, the next exam in 9 days, their weak topics with a Revise button, and the newest items of each kind; taps Revise or Ask the tutor and is in a chat scoped to the course.

## 2. Decisions made
| Question | Decision |
|---|---|
| Route | `/courses/[id]`, a client page like Library (data read in the browser with the student's own session) |
| Header | Course colour banner with the name, a summary line of counts, and actions: Upload, Ask the tutor (new chat in this course), Open in Library |
| Cards due | One strip: "N cards due" with a Review link (`/review`), only when some are due |
| Exam | The next unfinished dated exam task of the course ("Exam: Midterm in 9 days"), with a link to the planner where the study plan is made; nothing when there is none |
| Topics | The course's topics with status chips and the progress line; weak spots (existing rule) get a Revise button that starts the tutor on the topic. "Edit topics" links to Progress. A course with no topics shows a short pointer to Progress |
| Material | One section per kind (Notes, Decks, Lectures, Quizzes, Tutor chats) that has items, newest 5 each, "See all N in Library" when more (Library opens on this course) |
| Empty course | Says what goes in it, with Upload and Write a note |
| Unknown course | A calm "course not found" with a link to Library (also for ids that are not valid) |
| Entry points | Library shows an "Open course page" link when a course is chosen; each course heading in Progress links to its page |
| Not in this build | Editing the course from its page, the day-by-day study plan inside the page (the planner keeps it), per-course XP, sharing |

## 3. Data
No migration. `loadCoursePage(sb, courseId, now)` reads: the course, the library items (existing `loadLibrary`) filtered to the course, the topic stats, and the next exam task. Deck items gain an optional `due` count so the page can total cards due without reading text.

## 4. Pure logic (`lib/course/summary.ts`)
- `courseSections(items, courseId)`: per kind with items, `{ kind, total, shown }` (newest first, at most 5), in the order note, deck, lecture, quiz, chat.
- `summaryLine(items)`: "4 notes · 2 decks" (zero kinds skipped, singular for one), "Nothing here yet" when empty.
- `cardsDue(items)`: total of the decks' due counts.
- `examLine(task, now)`: "Midterm · in 9 days", "· tomorrow", "· today"; a past exam is not shown (the query only returns future ones).

## 5. Edge cases
| Situation | Behaviour |
|---|---|
| Topic or tutor action fails | A toast, the page stays; a second tap cannot start a second chat |
| Items load fails | Message with Try again; the header still shows the course |
| Course deleted elsewhere | Not found state |
| Quiz whose note moved | Follows its note (already how Library works) |

## 6. Testing
Unit: sections, summary line, cards due, exam line, loader (filters by course, picks next exam), page states (loading, not found, empty, full, error, revise, ask tutor). E2E: a student with a note and deck in Biology opens the course from Library and sees them; axe on the page in the four looks, light and dark.

## 7. Build order
1. Pure logic and deck `due`. 2. Loader. 3. Page. 4. Navigation (middleware, robots, top bar title, Library and Progress links). 5. E2E, a11y, review.
