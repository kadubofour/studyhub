# Leaderboards and sharing

Studyhub is a study app for one student today: notes, notebooks, flashcard decks, courses, a planner, a focus timer, and
XP, levels and streaks. This adds the social side: students see how they are doing against friends and study groups, and
they can send what they made to someone else.

## Why

Studying alone is easier to drop. A friend a little ahead this week, or a group racing to the end of term, gives a reason
to open the app today. And students already pass notes and decks around (screenshots, WhatsApp files); a link that opens
the real thing, and copies it into the other person's Studyhub, is better for them and brings new students in.

## Goals

- **Leaderboards** against **friends** and against each **study group** a student is in.
- Every board has two views: **This week** (resets every Monday, so anyone can top it) and **All time**.
- **Sharing by link** of a **deck**, a **note**, a **notebook** (with its notes), and a **progress card**.
- A shared link opens for **anyone with the link**, signed in or not. The owner can **turn a link off** at any time.
- Copying gives the other person **their own, separate copy**.

## Non-goals

- A public, everyone-on-Studyhub board.
- Chat, comments, likes, or a feed.
- Live, shared editing of a note or deck.
- Sharing quizzes, lectures, tutor chats or courses (could come later).
- Notifications about friends ("Ama passed you").

## Anti-goals: it fails even if it works when…

- A student shows up on a board, or their name or numbers are seen, by someone they have not added as a friend or joined a
  group with.
- A shared link shows anything beyond the one item shared: no other notes, no email, no courses, no account details.
- A student's rank can be faked by writing their own XP from the browser, or by back-filling activity into past days.
- A turned-off link still opens.
- It looks bolted on: the boards, share sheets and shared pages must follow the active look, theme and phone layout like
  the rest of the app.

## Decided with the student

### Friends

- Each student has a **personal friend code and link**. Using someone's code or link **sends them a friend request**,
  which they **accept or decline** (a list of requests waits for them in the app). A code posted publicly cannot add
  strangers by itself. The student can make a new code, which stops the old one.
- **An in-app way when both are online at the same moment** ("Add in person"; this shape is my reading of the student's
  words): one student shows a **short code and a QR code that work for a few minutes**, the other types or scans it, and
  they become friends **at once**, with no request to approve, because both are there.
- Either can remove the other at any time; they then disappear from each other's friends board.

### Study groups

- Anyone can **create a group** (a name) and gets an **invite link and code**. Anyone with it can join.
- **The creator manages it**: renames it, removes members, makes a new invite (the old one stops working), deletes it.
- Members can **leave**. **Up to 50 members** per group.
- Each group has its own board.

### What a board shows

- Per student: **display name, avatar** (the existing initial on their avatar colour), **level, streak and XP**.
  Never their notes, courses, email or anything else.
- Ranked by **XP**: **This week** (from Monday 00:00 in each student's own time zone to now; ties broken by streak, then name) and
  **All time** (total XP). The student's own row is always shown and marked, even outside the top of a long board.
- A setting, **Show me on leaderboards** (on by default), hides the student from every board. They keep seeing the boards
  themselves, and they keep their friends and groups. A hidden student still appears **by name and avatar, without
  numbers**, in their friends' friend lists and in their groups' member lists, so those can still be managed.

### Sharing

- Every shared page says **"Shared by" with the owner's display name and avatar** at the top, and nothing else about them.
- **Deck**: the shared page shows its name and cards (front and back). Copying makes a new deck in the copier's account
  with every card on a **fresh review schedule**.
- **Note**: the shared page shows the note read-only, with its pictures, equations and highlights, as the reading view
  shows it. Copying makes a new note.
- **Notebook**: the shared page lists its notes and opens each, read-only. Copying makes a new notebook with copies of all
  its notes.
- **Progress card**: a picture of the student's level, streak, this week's XP and focus time, in their look and accent.
  On a phone it opens the phone's own **share sheet** (WhatsApp, Instagram and the rest). On a computer it **downloads**,
  and there is also **Copy link**, a link to a page showing the same card. The card (picture and link) is a **snapshot of the
  numbers when it was made**, with the student's name and avatar. The leaderboard setting does not affect it, since sharing
  it is a deliberate choice.
- Copies are **separate**: later edits by the owner never reach a copy, and a copy never links back to the owner's
  account. A copy has no course (the copier's courses are their own).
- **Anyone with the link** can open it, signed in or not. To copy, a signed-out visitor is asked to **sign up or log in**
  and then comes back to copy.
- The owner can **turn the link off** (it stops opening at once) or **make a new link** (the old one stops opening).
  Deleting the item turns its link off.

## Constraints

- **Stack**: Next.js 16 (App Router; read the guides in `node_modules/next/dist/docs/` before writing routes, as the
  project's `AGENTS.md` says), React 19 with the React Compiler lint, Tailwind 4, Supabase (Postgres with row-level
  security, Auth, Storage), vitest and Playwright. Database changes are migrations in `supabase/migrations/`.
- **Privacy is enforced in the database**, not only in the UI: row-level security and security-definer functions decide
  who can read what. A friend or group board returns only the fields listed above, only for people the viewer is linked
  to, and only those who have not hidden themselves.
- **Only on-time activity counts toward XP** (decided with the student): an XP-earning record (a review, a focus session,
  a done task, a plan session, a quiz, a tutor message, a lecture, a game) counts only if the server received it **within a
  day of the time it claims**, by the server's own clock. Back-filled past days earn nothing. Normal use, including a
  phone that saves a little late, is unaffected. This needs a server-set "received at" time on those records.
- **XP must be computed on the server** for boards. Today XP is worked out in the browser (`lib/xp/rules.ts`, from the
  `activity_by_day` function) from the student's own rows, which RLS keeps private. Boards need other students' XP, and a
  number the browser sends could be faked.
- **Note pictures live in a private bucket.** A shared note or notebook page must show them only for that item, without
  opening the bucket.
- **Shared links are unguessable**: a random token of at least 128 bits, never an item's id.
- **Shared pages are never indexed** (`noindex`), like the rest of the signed-in app.
- Follows the app's design rules: the shared look system (`app/globals.css`, `lib/appearance.ts`), the shell and phone
  dock, `PageHeader`, the shared empty state, and the look-aware message and confirm pop-ups.
- Tests in the project's style: a failing test first for each behaviour (unit tests in `tests/unit`, database tests in
  `tests/db` against the local Supabase, end-to-end tests in `e2e` on desktop and phone).

## My calls (made for the student, who asked me to pick the recommended options)

- **One XP source of truth on the server.** The XP rules move into SQL: a function computes a student's daily XP from
  their activity, and boards and the student's own XP both read it. Today's TypeScript rules stay only if a test proves
  they give the same numbers as the SQL on the same days. Otherwise the client reads the server's numbers. This keeps a
  board and the student's own level from ever disagreeing.
- **Where it lives**:
  - a **Leaderboard** page, reached from the sidebar and the phone's Search, with tabs for Friends and each group, and
    the This week / All time switch;
  - **Friends** and **Groups** management in that page (invite, accept, remove; create, join, manage);
  - a **Share** action on decks, notes and notebooks (their menus, the note's phone side menu, and the desktop File menu);
  - a **Share my progress** action on Progress and Profile.
- **Shared pages** live outside the signed-in app (like `/print`), so they open without an account. They wear the
  **owner's look and accent**, so the page feels like theirs.
- **An invite link that is opened while signed out** leads to sign up or log in, then straight back to accept or join.
- **Rate limits** on making invites and on copying, so a link cannot be used to flood an account.
- **Each student's days follow their own time zone** (from their profile), for their daily XP, streak and when their week
  starts. So a board and a student's own level always agree; a board compares each student's own Monday-to-now week.
- **A group's creator who leaves** passes the group to the longest-standing member. With nobody left, the group is deleted.

## Left to the builder

- Table and function names and shapes, indexes, and how tokens are stored (hashed or not).
- Whether the progress card picture is drawn in the browser (canvas or SVG to PNG) or on the server, as long as it works
  offline-friendly on a phone and wears the look.
- How a signed-out visitor's "copy this" survives sign-up (a return URL is enough).
- Loading, empty and error states, following the app's existing patterns and shared components.
- Paging or capping long boards (groups are at most 50, so a full list is fine).
