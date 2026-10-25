# Leaderboards and Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friends and study-group leaderboards (This week / All time XP), fair XP worked out on the server from on-time
activity only, and link sharing of decks, notes, notebooks and a progress card.

**Architecture:** Everything that decides who sees what lives in Postgres. There are new tables with row-level security
and `security definer` functions that return only the allowed fields. XP rules move into SQL (`day_xp`), read through
`my_xp_days()` by the student and `leaderboard()` by boards. A shared link is a random token. Its public page
(`/s/[token]`) reads one item through `shared_item(token)`; pictures go through a token-checked route, and copying goes
through a route that also copies picture files.

**Tech Stack:**
- Next.js 16 App Router (read `node_modules/next/dist/docs/` before writing routes).
- React 19 with the React Compiler lint (no ref reads during render; no `Date.now()` in render).
- Tailwind 4.
- Supabase (Postgres RLS, Auth, Storage).
- vitest (`tests/unit` jsdom, `tests/db` against local Supabase) and Playwright (`e2e`, desktop and mobile projects).

**Spec:** `docs/superpowers/specs/2026-10-25-leaderboard-and-sharing-design.md`

## Global Constraints

**Privacy**
- A board shows per student only: display name, avatar (initial on `avatar_color`), level, streak, XP. Never notes,
  courses or email.
- A student appears only to accepted friends and fellow group members, and only if `show_on_boards` is true. Their own row
  always shows to them.
- A hidden student still appears by name and avatar, **without numbers**, in friend lists and group member lists.

**Boards and XP**
- **This week** runs from Monday 00:00 in each student's own `profiles.timezone` to now.
- Ties are broken by streak, then display name.
- **All time** is total XP.
- Each student's days follow their own `profiles.timezone`.
- **On-time rule:** an XP-earning record counts only if `abs(claimed time - server received time) <= interval '1 day'`.
- The XP numbers must equal `lib/xp/rules.ts` exactly: per-unit XP and daily caps (reviews 1/50, quizzes 10/5, focus per
  5 min 1/24, tasks 5/10, plans 8/8, tutor 2/10, lectures 15/2, games 8/3), the 20 XP bonus when all three goals are met
  (10 reviews, 25 focus minutes, 1 quiz), and level n starting at `50 * (n - 1)^2`.

**Friends**
- Friends are added by a personal code or link. Using it sends a request, which the owner accepts or declines.
- Making a new code stops the old one.
- **Add in person:** a 6-digit code valid for **5 minutes**, which makes the two students friends at once.

**Groups**
- At most **50 members**.
- The creator manages it: rename, remove members, new invite (the old one stops), delete.
- Members can leave. When the creator leaves, the group passes to the longest-standing member; with nobody left, it is
  deleted.

**Sharing**
- A shared link is a random token of **at least 128 bits**, never an item id.
- It opens for anyone with the link, signed in or not.
- The owner can turn it off (it stops opening at once) or make a new link (the old one stops).
- Deleting the item turns its link off.
- Every shared page says **"Shared by" with the owner's display name and avatar**, and nothing else about them.
- Shared pages are `noindex` and wear the owner's look and accent.
- A copy is separate, has no course, and a copied deck's cards start on a fresh schedule.
- The progress card is a **snapshot of the numbers when it was made**, with name and avatar. The board setting does not
  affect it.

**Limits**
- Rate limits, per student per hour: friend requests 20, in-person codes 30, group joins 20, new share links 60,
  copies 30. Over the limit, the call errors with `rate_limited`.

**Everything new**
- Follows the look system, the phone dock, `PageHeader`, `EmptyState` and `BackLink`, and the look-aware
  toast/confirm (`lib/ui/appRoot.ts`).

## Review Focus

1. **A link turned off while a visitor has the page open:** their Copy must fail with "This link was turned off", not copy.
   Test in Task 9.
2. **A student added by two routes at once** (a request pending and also Add in person): they become friends once, and
   the pending request disappears. Test in Task 3.
3. **A group at 50 members:** the 51st join errors `group_full`, and the group is unchanged. Test in Task 4.
4. **A note whose picture file was deleted:** the shared page and the copy still work; that picture shows as missing.
   Test in Task 9.
5. **Clock skew:** a review saved 23 hours late still counts, and one saved 25 hours late does not. Test in Task 1.

---

### Task 1: Server-stamped "received" times on XP-earning records

**Files:**
- Create: `supabase/migrations/20261108000000_on_time.sql`
- Test: `tests/db/onTime.test.ts`

**Interfaces:**
- Produces: these columns, each set by a `before insert or update` trigger to `now()` and never writable by the client:
  - `received_at timestamptz not null` on `reviews`, `focus_sessions`, `tutor_messages`, `lectures` and `game_plays`;
  - `done_received_at timestamptz` on `tasks`, set when `done_at` becomes non-null or changes, and null when `done_at` is
    null;
  - `finished_received_at timestamptz` on `quiz_attempts`, the same rule for `finished_at`;
  - `study_plan_days.sessions[*].done_received_at`, written by the trigger into each session's jsonb when its `done_at`
    appears or changes.
- Existing rows are back-filled with the claimed time, so history keeps counting.
- Produces: `public.on_time(claimed timestamptz, received timestamptz) returns boolean`, immutable, defined as
  `received is not null and abs(extract(epoch from received - claimed)) <= 86400`.

- [ ] **Step 1: Write the failing tests** in `tests/db/onTime.test.ts`:
  - `received_at is the server's time, whatever the client sends`: insert a review with
    `received_at: '2020-01-01T00:00:00Z'`; read it back; expect it within 60 s of now.
  - `a task's done_received_at is stamped when it is ticked, and cleared when it is unticked`.
  - `a plan session's done_received_at is stamped in its jsonb when it is ticked`.
  - `on_time: 23 hours late counts, 25 hours late does not` via `select public.on_time(...)` with fixed timestamps
    (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run tests/db/onTime.test.ts`. Expected: FAIL (column or function does not exist).
- [ ] **Step 3: Write the migration.** It adds the columns, triggers, back-fill and `on_time`.
- [ ] **Step 4: Run** `npx supabase db reset` (local only), then `npx vitest run tests/db`. Expected: all pass, including
  the existing `activity.test.ts`, which is unchanged because `activity_by_day` is not touched.
- [ ] **Step 5: Commit** with `feat: server-stamped received times on XP-earning records`.

### Task 2: XP worked out on the server, and the app reading it

**Files:**
- Create: `supabase/migrations/20261109000000_server_xp.sql`
- Modify: `lib/xp/rules.ts`, `components/xp/useXp.ts`, `lib/data/activity.ts`
- Test: `tests/db/serverXp.test.ts`, `tests/unit/xpRules.test.ts` (extend), the existing `useXp` users' unit tests

**Interfaces:**
- Produces, in SQL:
  - `public.xp_days(p_user uuid) returns table(day date, xp int)`: `security definer`, `execute` revoked from public,
    anon and authenticated. It counts only `on_time` records, groups days in `p_user`'s `profiles.timezone`, and applies
    the caps and bonus from Global Constraints.
  - `public.my_xp_days() returns table(day date, xp int)`: granted to authenticated; returns `xp_days(auth.uid())`.
  - `public.xp_totals(p_user uuid) returns table(total int, week int, streak int)`: internal like `xp_days`. `week` is
    from this Monday in the student's zone; `streak` counts back from today, or yesterday if today has no XP.
- Produces, in TypeScript:
  - `export type XpDay = { day: DayKey; xp: number }`.
  - `summarize(days: ActivityDay[], today: DayKey, xpDays?: XpDay[])`: when `xpDays` is given, `total`, `today`,
    `streak`, `best`, `level` and `last14` come from it, and goals still come from `days`.
  - `loadXpDays(sb): Promise<XpDay[]>` in `lib/data/activity.ts`, calling `my_xp_days`.
- `useXp` loads both and passes `xpDays`.

- [ ] **Step 1: Write the failing tests:**
  - db `my_xp_days matches dayXp for the same on-time activity`: make a user, insert today's activity across every kind,
    including over-cap counts and a met bonus. Compare `my_xp_days` with `dayXp()` from `lib/xp/rules.ts` applied to
    `activity_by_day('America/New_York')` rows for those days. Expect equal.
  - db `back-filled activity earns no XP`: insert a review with `reviewed_at` 10 days ago. `activity_by_day` shows it;
    `my_xp_days` does not.
  - db `xp_days cannot be called by a student`: `rpc('xp_days', { p_user: other })` errors.
  - unit `summarize takes total, streak and level from server XP when given`: activity with 0 XP and
    `xpDays=[{day: today, xp: 60}]` gives `total` 60, `level.level` 2 and `streak` 1.
- [ ] **Step 2: Run** `npx vitest run tests/db/serverXp.test.ts tests/unit/xpRules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration and the TypeScript changes** to the Interfaces above. Update unit tests that mock
  `@/lib/data/activity` to also mock `loadXpDays`.
- [ ] **Step 4: Run** `npx vitest run tests/unit tests/db`. Expected: all pass.
- [ ] **Step 5: Commit** with `feat: XP is worked out on the server from on-time activity`.

### Task 3: Friends: codes, requests, Add in person, the board setting

**Files:**
- Create: `supabase/migrations/20261110000000_friends.sql`
- Test: `tests/db/friends.test.ts`

**Interfaces:**
- Produces:
  - `profiles.show_on_boards boolean not null default true`.
  - `profiles.friend_code text unique not null`: 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, set at sign-up and
    back-filled for existing students.
  - Tables:
    - `friend_requests (from_id, to_id, created_at)`, unique `(from_id, to_id)`;
    - `friendships (a uuid, b uuid, created_at)` with `check (a < b)`, primary key `(a, b)`;
    - `in_person_codes (code text primary key, user_id, expires_at)`;
    - `social_log (user_id, action text, at timestamptz default now())`.
  - All have RLS. Students may `select` only rows they are in. Writes go only through the functions below.
- Produces these RPCs, all `security definer`:
  - `send_friend_request(p_code text) returns void`. Errors: `not_found`, `self`, `already_friends`, `rate_limited`.
    If the other student has already sent this student a request, they become friends at once and both requests go.
  - `respond_friend_request(p_from uuid, p_accept boolean) returns void`.
  - `remove_friend(p_other uuid) returns void`.
  - `new_friend_code() returns text`.
  - `start_in_person() returns table(code text, expires_at timestamptz)`.
  - `redeem_in_person(p_code text) returns void`. Errors: `expired`, `self`, `rate_limited`. It makes them friends,
    deletes any pending requests between them, and deletes the code.
  - `my_friends() returns table(user_id uuid, display_name text, avatar_color text)`.
  - `my_friend_requests() returns table(from_id uuid, display_name text, avatar_color text, created_at timestamptz)`.
  - `public.social_rate(p_action text, p_limit int) returns void`, internal: it logs the action and raises
    `rate_limited` past `p_limit` in the last hour.

- [ ] **Step 1: Write the failing tests:**
  - `a code sends a request; accepting makes both friends; declining does not`.
  - `two requests crossing make friends at once`.
  - `a new code stops the old one`.
  - `Add in person makes friends at once and clears a pending request between them` (Review Focus 2).
  - `an in-person code stops working after 5 minutes`: set `expires_at` in the past through `adminClient()`; redeem
    errors `expired`.
  - `a student cannot read other students' friendships or requests` (`select` returns `[]`).
  - `the 21st friend request in an hour is rate_limited`.
- [ ] **Step 2: Run** `npx vitest run tests/db/friends.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `npx vitest run tests/db`. Expected: all pass.
- [ ] **Step 5: Commit** with `feat: friends: codes, requests and Add in person`.

### Task 4: Study groups

**Files:**
- Create: `supabase/migrations/20261111000000_groups.sql`
- Test: `tests/db/groups.test.ts`

**Interfaces:**
- Produces tables:
  - `study_groups (id, name text check (char_length(name) between 1 and 60), owner_id, invite_token text unique, created_at)`;
  - `group_members (group_id, user_id, joined_at)`, primary key `(group_id, user_id)`.
- RLS: members may select their groups and the member rows. All writes go through RPCs.
- Produces these RPCs:
  - `create_group(p_name text) returns uuid`.
  - `join_group(p_token text) returns uuid`. Errors: `not_found`, `group_full` at 50, `rate_limited`.
  - `leave_group(p_group uuid)`: when the owner leaves, ownership passes to the earliest `joined_at`; with no members
    left, the group is deleted.
  - Owner-only: `rename_group(p_group uuid, p_name text)`, `remove_member(p_group uuid, p_user uuid)`,
    `new_group_invite(p_group uuid) returns text`, `delete_group(p_group uuid)`.
  - `my_groups() returns table(id uuid, name text, is_owner boolean, members int, invite_token text)`. The token is
    shown only to the owner and is null for others.
  - `group_members_of(p_group uuid) returns table(user_id uuid, display_name text, avatar_color text, is_owner boolean)`.
  - `group_preview(p_token text) returns table(name text, members int)`, for the join page.

- [ ] **Step 1: Write the failing tests:**
  - `join with the invite; the creator removes a member; a member cannot remove`.
  - `a new invite stops the old one`.
  - `the 51st join is group_full and nothing changes` (Review Focus 3): seed 50 members through `adminClient()`.
  - `the creator leaving passes the group to the longest-standing member; the last to leave deletes it`.
  - `a non-member cannot see the group or its members`.
- [ ] **Step 2: Run** `npx vitest run tests/db/groups.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `npx vitest run tests/db`. Expected: all pass.
- [ ] **Step 5: Commit** with `feat: study groups`.

### Task 5: The leaderboard function

**Files:**
- Create: `supabase/migrations/20261112000000_leaderboard.sql`
- Test: `tests/db/leaderboard.test.ts`

**Interfaces:**
- Consumes: `xp_totals` (Task 2), `friendships` (Task 3), `group_members` (Task 4).
- Produces: `public.leaderboard(p_group uuid default null) returns table(user_id uuid, display_name text,
  avatar_color text, total_xp int, week_xp int, streak int, is_me boolean)`.
  - With null it covers the caller and their friends; with a group, that group's members (an error if the caller is not
    a member).
  - It excludes `show_on_boards = false` except the caller.
  - It is unordered; the client sorts by the view.

- [ ] **Step 1: Write the failing tests:**
  - `the friends board shows me and my friends with their XP, and no one else`.
  - `a hidden friend is left off, but I always see myself when hidden`.
  - `a group board needs membership`.
  - `numbers match xp_totals`.
- [ ] **Step 2: Run** `npx vitest run tests/db/leaderboard.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `npx vitest run tests/db`. Expected: all pass.
- [ ] **Step 5: Commit** with `feat: leaderboard for friends and groups`.

### Task 6: The Leaderboard page, friends and groups in the app

**Files:**
- Create:
  - `lib/data/social.ts`
  - `lib/social/rank.ts`
  - `app/(app)/leaderboard/page.tsx`
  - `components/social/Board.tsx`
  - `components/social/FriendsPanel.tsx`
  - `components/social/GroupsPanel.tsx`
  - `components/social/InPersonDialog.tsx`
- Modify:
  - `lib/shell/nav.ts`: add `{ href: '/leaderboard', label: 'Leaderboard', icon: Trophy, keywords: 'friends groups rank xp' }`
    after Progress;
  - `lib/supabase/middleware.ts`: add `/leaderboard` to `APP_PATHS`;
  - `components/settings/AppearanceCard.tsx` or a new Settings section: a **Show me on leaderboards** switch saving
    `profiles.show_on_boards`;
  - `lib/types.ts`: `show_on_boards`, `friend_code` on `Profile`.
- Test:
  - `tests/unit/rank.test.ts`
  - `tests/unit/leaderboardPage.test.tsx`
  - `e2e/leaderboard.spec.ts`

**Interfaces:**
- Consumes: the RPCs of Tasks 3–5.
- Produces:
  - `lib/data/social.ts`: thin typed wrappers, one per RPC, with the same names in camelCase (`sendFriendRequest(sb, code)`
    and so on). An error's code (for example `rate_limited`) is thrown as `Error(code)`.
  - `rankRows(rows: BoardRow[], view: 'week' | 'all'): RankedRow[]` in `lib/social/rank.ts`. It sorts by XP descending,
    then streak, then name, and gives equal places to equal XP and streak. `RankedRow = BoardRow & { place: number; level: number }`,
    with level from `levelInfo`.
- The page:
  - `PageHeader title="Leaderboard"`;
  - tabs: **Friends**, then each group by name (the `CourseBar`-style chips, with `useEdgeFade`);
  - a segmented **This week / All time** switch;
  - rows of place, avatar, name, level, streak and XP; my row marked "You";
  - **Friends** panel: my code with Copy and Share link (`/add/<code>`), New code, requests with Accept and Decline, Add in
    person (show code with a QR, or enter a code), remove a friend;
  - **Groups** panel: Create, Join with a code, and for the owner Rename, Invite link, New invite, Remove member, Delete;
    Leave for others.
- An empty friends board uses `EmptyState` with "Add your first friend" and the code.

- [ ] **Step 1: Write the failing tests:**
  - unit `rankRows`: ties share a place, the week view ignores total, and the level comes from total.
  - unit `the Leaderboard page lists the friends board in week order with my row marked You`, mocking `lib/data/social`.
  - unit `switching to All time re-sorts`.
  - unit `a request can be accepted from the page`.
  - unit `nav has Leaderboard after Progress`.
  - e2e (two browser contexts) `friend by code: request, accept, both see each other on the board`.
  - e2e `Add in person: one shows a code, the other enters it, both become friends at once`.
  - e2e `create a group, join by its link, both on the group board`.
  - e2e on mobile: `the Leaderboard page fits a phone with no sideways scroll`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/rank.test.ts tests/unit/leaderboardPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** to the Interfaces. Draw the QR with a dependency only if one already exists in
  `package.json`; otherwise draw the code large with no QR and record that as a ruling.
- [ ] **Step 4: Run** `npx vitest run tests/unit` and `npx playwright test e2e/leaderboard.spec.ts`, with the preview
  server stopped. Expected: all pass.
- [ ] **Step 5: Commit** with `feat: the Leaderboard page with friends and groups`.

### Task 7: Invite links that work signed in or out

**Files:**
- Create: `app/(app)/add/[code]/page.tsx`, `app/(app)/join/[token]/page.tsx`
- Modify: `lib/supabase/middleware.ts` (add `/add`, `/join` to `APP_PATHS`, so a signed-out visitor goes to `/login?next=…`)
- Test: `e2e/invites.spec.ts`

**Interfaces:**
- `/add/[code]`: shows the code owner's name and avatar through a new RPC `friend_code_preview(p_code text) returns
  table(display_name text, avatar_color text)`, then **Send friend request**.
- `/join/[token]`: shows `group_preview`, then **Join group**. On success both go to `/leaderboard`.

- [ ] **Step 1: Write the failing e2e test** `opening a friend link while signed out asks to sign in, then comes back to
  send the request`.
- [ ] **Step 2: Run** `npx playwright test e2e/invites.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages and `friend_code_preview` (in migration `20261112000001_friend_preview.sql`, with
  a db test in `tests/db/friends.test.ts` that the preview returns only name and avatar).
- [ ] **Step 4: Run** the e2e and `npx vitest run tests/db/friends.test.ts`. Expected: pass.
- [ ] **Step 5: Commit** with `feat: friend and group invite links`.

### Task 8: Shares in the database

**Files:**
- Create: `supabase/migrations/20261113000000_shares.sql`
- Test: `tests/db/shares.test.ts`

**Interfaces:**
- Produces the table `shares (token text primary key, owner_id, kind text check (kind in ('deck','note','notebook','progress')),
  item_id uuid, snapshot jsonb, created_at, revoked_at timestamptz)`.
  - At most one active share per `(owner_id, kind, item_id)` for decks, notes and notebooks.
  - The token is 22 or more URL-safe characters from `gen_random_bytes(16)` or more.
  - Deleting the item revokes its share, by trigger or by `on delete` handling.
- Produces these RPCs:
  - `share_item(p_kind text, p_item uuid) returns text`: the caller must own the item. It returns the active token or
    makes one. Rate limited at 60.
  - `reshare_item(p_kind text, p_item uuid) returns text`: revokes, then makes a new token.
  - `unshare_item(p_kind text, p_item uuid) returns void`.
  - `share_progress() returns text`: a new token with
    `snapshot = { level, total_xp, week_xp, streak, week_focus_minutes, display_name, avatar_color }` from `xp_totals`
    and focus sessions.
  - `shared_item(p_token text) returns jsonb`, granted to anon and authenticated. It returns null when the token is
    revoked or missing; otherwise
    `{ kind, owner: { display_name, avatar_color, look, accent }, item }`:
    - deck: `{ name, cards: [{ front, back }] }`;
    - note: `{ title, content_md }`;
    - notebook: `{ name, notes: [{ id, title, content_md }] }`;
    - progress: the snapshot.
  - `copy_shared(p_token text) returns table(kind text, id uuid)`, authenticated only. It errors `link_off` when the
    token is revoked or missing and `rate_limited` at 30. It inserts copies owned by the caller with no course; a deck's
    cards get the defaults for a new card.
  - `shared_note_files(p_token text) returns table(owner_id uuid, file text)`, internal: the picture files the shared
    item's notes use, for the routes in Task 9.

- [ ] **Step 1: Write the failing tests:**
  - `anyone (anon) can read a shared deck, and only that deck`: the result has no `user_id`, email or course.
  - `a revoked link returns null and cannot be copied (link_off)`.
  - `deleting the item turns its link off`.
  - `copy_shared makes a separate deck with fresh cards`: edit the original afterwards; the copy is unchanged.
  - `only the owner can share an item`.
  - `share_progress snapshots the numbers`.
- [ ] **Step 2: Run** `npx vitest run tests/db/shares.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** `npx vitest run tests/db`. Expected: all pass.
- [ ] **Step 5: Commit** with `feat: share links for decks, notes, notebooks and progress`.

### Task 9: The shared pages, pictures and copying

**Files:**
- Create:
  - `app/s/[token]/page.tsx`: server component, `metadata.robots` noindex, outside the signed-in app;
  - `app/s/[token]/image/[file]/route.ts`;
  - `app/api/share/[token]/copy/route.ts`;
  - `components/share/SharedView.tsx`.
- Test:
  - `tests/unit/sharedView.test.tsx`
  - `tests/unit/shareRoutes.test.ts`
  - `e2e/sharing.spec.ts`

**Interfaces:**
- Consumes: `shared_item`, `copy_shared` and `shared_note_files` (Task 8); `lib/notes/images.ts`
  (`imageFilesIn`, `tokenFile`, `IMAGE_BUCKET`); `lib/supabase/admin.ts`.
- **Page:**
  - It wraps the item in `.app-root[data-look=owner.look]` with the owner's accent variables, so it wears their look.
  - Top: "Shared by", the avatar and the display name.
  - Body:
    - a deck shows its cards;
    - a note uses the reading view, with picture tokens resolved to `/s/<token>/image/<file>`;
    - a notebook shows its list and opens each note in place;
    - progress shows the card from Task 11.
  - **Copy to my Studyhub**: signed out, it goes to `/login?next=/s/<token>?copy=1`; signed in, it POSTs to the copy
    route and then goes to the new item.
- **Image route:**
  - It checks that the file is in `shared_note_files(token)`.
  - It redirects to a 1-hour signed URL from the admin client.
  - Otherwise it returns 404, including when the file is missing.
- **Copy route:**
  - It authenticates the caller and calls `copy_shared` with the caller's session.
  - It copies each `shared_note_files` file from `owner/file` to `caller/file` with the admin storage client, skipping
    missing ones.
  - It returns `{ kind, id }`; on `link_off` it returns 410 with `{ error: 'link_off' }`.

- [ ] **Step 1: Write the failing tests:**
  - unit `SharedView shows Shared by with the name, and the deck's cards`.
  - unit `a turned-off link shows "This link was turned off"`.
  - unit route `the image route refuses a file the shared note does not use` (404).
  - unit route `copy returns 410 link_off for a revoked token` (Review Focus 1).
  - unit route `copy skips a missing picture and still succeeds` (Review Focus 4).
  - e2e `a signed-out visitor opens a shared note, signs up, copies it, and the copy opens with its picture`.
- [ ] **Step 2: Run** the unit tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/unit` and `npx playwright test e2e/sharing.spec.ts`. Expected: pass.
- [ ] **Step 5: Commit** with `feat: shared pages, pictures and copying`.

### Task 10: Share from decks, notes and notebooks

**Files:**
- Create: `components/share/ShareDialog.tsx`, `lib/data/shares.ts`
- Modify:
  - `app/(app)/flashcards/[deck]/page.tsx`: a Share button in the header actions;
  - `components/notes/NoteMenuBar.tsx`: File, then "Share…";
  - `components/notes/NoteSheet.tsx`: a "Share" row after "Remind me";
  - `components/notes/NotesSidebar.tsx`: the note's row menu, "Share…";
  - `app/(app)/notebooks/[id]/page.tsx`: a Share button.
- Test: `tests/unit/shareDialog.test.tsx`, plus extending `tests/unit/noteSheet.test.tsx` and its row-order test.

**Interfaces:**
- Consumes: `share_item`, `reshare_item` and `unshare_item` through
  `lib/data/shares.ts` → `shareItem(sb, kind, id)`, `reshareItem(sb, kind, id)`, `unshareItem(sb, kind, id)`.
- `ShareDialog({ kind, id, title })` shows the link `${origin}/s/${token}` with **Copy link**, **Share** (calls
  `navigator.share({ title, url })` when available), **New link** and **Turn off link** (this one confirms first).
- It uses the look-aware toast for "Link copied".

- [ ] **Step 1: Write the failing tests:**
  - `opening Share makes or reads the link and shows it`.
  - `Copy link copies it and says so`.
  - `Turn off link asks first, then turns it off`.
  - `the phone note menu has Share after Remind me`: the row order becomes `Find in note, Insert equation, Remind me,
    Share, Upload, Export as Word, Export as PDF, New note, Delete note`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/unit` and the note and deck e2e specs. Expected: pass.
- [ ] **Step 5: Commit** with `feat: share decks, notes and notebooks`.

### Task 11: Share my progress

**Files:**
- Create: `components/share/ProgressCard.tsx`, `lib/share/cardImage.ts`
- Modify: `app/(app)/progress/page.tsx` and `app/(app)/profile/page.tsx` (a **Share my progress** action)
- Test: `tests/unit/progressCard.test.tsx`

**Interfaces:**
- Consumes: `share_progress` (Task 8) through `shareProgress(sb): Promise<string>` in `lib/data/shares.ts`.
- `ProgressCard({ snapshot })` is an SVG 1080×1350 showing level, streak, this week's XP, focus time, name and avatar in
  the current look's tokens and accent. Text in it uses the app's fonts.
- `cardPng(svg: SVGSVGElement): Promise<Blob>` in `lib/share/cardImage.ts` renders it to a PNG through a canvas.
- The action:
  1. makes the snapshot link;
  2. renders the PNG;
  3. on a phone, calls `navigator.share({ files: [png], url })` when `navigator.canShare({ files })`; otherwise downloads
     `studyhub-progress.png`;
  4. always offers **Copy link**.

- [ ] **Step 1: Write the failing tests:**
  - `the card shows the snapshot's level, streak and week XP`.
  - `on a phone it opens the share sheet with the picture`: mock `navigator.canShare` and `navigator.share`.
  - `elsewhere it downloads the picture`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/unit`. Expected: pass.
- [ ] **Step 5: Commit** with `feat: share my progress as a card`.

### Task 12: Whole-feature check

- [ ] **Step 1: Run the checks:**
  - `npx vitest run tests/unit tests/db`;
  - `npx tsc --noEmit`;
  - `npx eslint app components lib tests e2e`;
  - `npx playwright test --workers=2`, with the preview stopped.
  Expected: all pass (known flakes rerun alone).
- [ ] **Step 2: Look** at `/leaderboard`, `/add/…`, `/join/…` and `/s/…` in every look, light and dark, at 375px and
  desktop; fix what does not match.
- [ ] **Step 3:** Remind the student to run `npx supabase db push` for migrations `20261108000000` to `20261113000000`
  before this goes live.
