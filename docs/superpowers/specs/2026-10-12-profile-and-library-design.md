# Profile page and Library

Two gaps: there is nowhere that says who the student is and what they have achieved, and study material lives in five separate lists (Notes, Flashcards, Lectures, Quizzes inside notes, Tutor chats) with no single place to see or sort all of it.

## 1. Goal
- **Profile:** one page with the student's name, avatar, school and programme, plan, level, streak, study totals and badges, and a way to edit the personal parts.
- **Library:** one page listing every note, deck, lecture, quiz and tutor chat, grouped by course, searchable, filterable by type, and with a way to move items between courses in bulk.

Success: a student opens Library, sees everything they have made, finds the loose items under "Unsorted", selects three of them and moves them into a course in one step; opens Profile and sees their level, their totals and the badges they have earned.

## 2. Decisions made
| Question | Decision |
|---|---|
| How material is organised | By **course**, which every kind already has (notes, decks, lectures, tutor chats; quizzes follow their note). No folders or tags in this build: one clear level is easier to keep tidy |
| Library layout | Course chips on top (All, Unsorted, each course, plus New course and Edit, reusing the planner's course controls), type chips with counts, a search box and a sort, then one list. Each row shows a type icon, title, course tag and a short line (cards due, minutes, edited date) |
| Moving | Tick rows, choose a course (or Unsorted), Move. Quizzes cannot be ticked: they follow their note, and a hint says so |
| Moving and topics | Topics belong to a course, so a moved note, lecture or deck is taken out of the old course's topics (it can be linked again in the new course) |
| Where it is | A **Library** entry first in the Study group of the sidebar; on phones, an icon in the Home banner and in the Notes header |
| Profile fields | Name (already there), **school**, **programme** (each up to 80 characters, optional), an **avatar colour** from eight choices; the avatar is the initials on that colour. No photo upload in this build |
| Profile stats | One database call returns the counts: notes, decks, cards, lectures and their minutes, finished quizzes, focus minutes, card reviews, games played, tutor messages, courses |
| Badges | 12 milestone badges worked out from those numbers and the XP summary (nothing stored): earned ones in colour, locked ones show progress ("3 / 10") |
| Entry points | A name and avatar chip at the bottom of the sidebar opens Profile; Settings stays where it is for time zone, goals, look and data |
| Not in this build | Folders and tags, drag and drop, bulk delete, profile photos, public or shared profiles |

## 3. Data
Migration `20261026000000_profile_page.sql`:
- `profiles` gains `school text`, `programme text` (both null or 1 to 80 characters) and `avatar_color text not null default '#3B5BDB'` (a `#rrggbb` value).
- `profile_stats()` (security invoker, so only the student's own rows) returns one row: `notes, decks, cards, lectures, lecture_minutes, quizzes_done, focus_minutes, reviews, games, tutor_messages, courses`.

## 4. Library rules (pure code in `lib/library`)
- An item is `{ kind, id, title, course_id, at, meta, href }`; a quiz takes its course from its note.
- Filters combine: course (all, unsorted or one), type, and a case-insensitive search of titles. Sort is newest first or by name.
- Counts per type respect the course and search filters (so the chips always say what a click would show), and counts per course ignore the type filter.
- Moving updates `course_id` on the notes, decks, lectures and chats chosen, in one request per kind, then removes the moved notes, lectures and decks from topics (`topic_links`). Nothing partial is shown as done: on any failure the list is read again.

## 5. Badges
First note (1 note), Note-taker (10), Card collector (50 cards), Reviewer (100 reviews), First lecture (1), Deep focus (10 hours focus), Quiz ace (5 finished quizzes), Player (5 games), Curious (20 tutor messages), 3-day streak, 7-day streak, Level 5. Each has a target; progress is the value over the target, capped at the target.

## 6. Edge cases
| Situation | Behaviour |
|---|---|
| A brand-new student | Library says what goes in it, with the Upload and New note actions; Profile shows zeros and every badge locked with its progress |
| Hundreds of items | One list read per kind (five requests), filtered in the browser |
| A course deleted from Library | Its items become Unsorted (or are deleted, as the existing delete dialog offers) and the list is read again |
| Moving an item the student does not own, or to a course they do not own | Refused by the database; the list is read again and a message says it could not be moved |
| Name left empty | The profile keeps the old name |

## 7. Testing
DB: new columns and limits, `profile_stats` counts and only own data. Unit: filtering, counting, sorting, moving (requests and the topic unlinking), badges, the Library page, the Profile page, the sidebar chip. E2E: a student makes a note and a deck, finds both under Unsorted, moves them into Biology, and sees them there; edits the profile and sees the change in the sidebar chip; accessibility checks on both pages.

## 8. Build order
1. Migration and database tests. 2. Library logic and data. 3. Library page. 4. Profile logic, page and sidebar chip. 5. Navigation, end-to-end tests, review.
