# Study Hub Phase 1 (Core Hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 study hub web app — accounts, minimal Home, planner with courses/tasks/timetable, notes (rich/markdown/math), spaced-repetition flashcards, Pomodoro focus timer with ambient sounds, progress, and settings.

**Architecture:** Next.js App Router (TypeScript) on Vercel, Supabase for Postgres + Auth with row-level security on every table. All date/scheduling/streak/timer rules live in pure, unit-tested modules under `lib/`. All database access goes through small typed functions in `lib/data/` that take a Supabase client — pages never write raw queries, and Phase 2 (scanning/AI) reuses the same create functions. Pages under `app/(app)/` are client components that load via `lib/data/` and save optimistically.

**Tech Stack:** Next.js (latest, App Router, Turbopack), React, TypeScript, Tailwind CSS v4, `@supabase/supabase-js` + `@supabase/ssr`, `date-fns-tz`, `next-themes`, `lucide-react`, Tiptap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-list`, `@tiptap/markdown`, `@tiptap/extension-mathematics`), `katex`, `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`, Vitest (+ jsdom), Playwright, Supabase CLI (local stack via Docker Desktop).

**Spec:** `docs/superpowers/specs/2026-10-01-study-hub-core-design.md`

## Global Constraints

- Node.js ≥ 20. Package manager: npm.
- Project root is `C:\Users\Fii\Desktop\study` (the app lives at the repo root, beside `docs/`).
- TypeScript strict mode; import alias `@/*` → project root.
- Every table has row-level security; every policy restricts to `user_id = auth.uid()` (profiles: `id = auth.uid()`).
- Sign-in: email/password with **no email confirmation**; signup asks for email twice. Google OAuth via Supabase.
- Unauthenticated requests to app pages redirect to `/login?next=<path>`; first login (profile `onboarded = false`) redirects to `/onboarding`.
- All "today/overdue/upcoming/streak" logic uses the profile's IANA `timezone`.
- Focus sessions are saved on completion, or on early stop if ≥ 5 minutes.
- Focus timer defaults: 25 / 5 / 15 minutes, long break every 4 focus sessions.
- Notes autosave ~1s after typing stops; notes stored as Markdown; math via `$inline$` and `$$block$$`, rendered with KaTeX.
- Optimistic saves revert on failure and show the toast text `Couldn't save.` with a `Retry` action.
- Offline: show the banner `You're offline` and retry pending writes on reconnect; no full offline mode.
- Deleting a course: user chooses "Delete its tasks, decks and notes" or "Keep them (no course)". Classes are always deleted.
- Home shows: greeting + date, Today (due today + overdue), inline "Add a task", and one row of buttons (next class, "Review N cards" only if N > 0, "Focus"). No streak, metric tiles, or charts on Home.
- UI copy: sentence case, no exclamation marks, no "successfully", no "please".
- Theme: light / dark / system toggle; clean, minimal, compact styling.
- Out of scope: AI, scanning, uploads, rotating timetables, focus↔course linking, full offline, drag-and-drop time-blocking, native apps.

## Review Focus

1. **Midnight and timezone boundaries** — a task due 23:30 local time must show under Today (not Upcoming) even when UTC has already rolled over, and "today" must follow the profile timezone across DST changes. → tests in Task 2.
2. **Timer through sleep / tab switches / reload** — a focus session that ends while the tab is hidden or the laptop sleeps must show 00:00 on return and be logged exactly once, never twice. → tests in Task 6 (`shouldLogSession`, `markLogged`) and Task 14.
3. **Double-rating a flashcard** — holding a number key (key repeat) or double-clicking must rate the current card once, not rate the next card too. → test in Task 13.
4. **Note edits during a slow save / leaving the page** — typing while a save is in flight must result in the latest text being saved; navigating away must flush the pending save; a failed save must be retried, not silently dropped. → tests in Task 15 (autosaver).
5. **Quick-add ambiguity** — a title that merely ends in a word like "sun" or "mon" gets a date; the user must see the parsed date before submitting, and titles with no date word must keep their full text with no due date. A lone date word ("friday") must not create an empty title. → tests in Task 3, preview in Task 11.

---

## File Structure

```
app/
  layout.tsx                      root html, ThemeProvider
  globals.css                     Tailwind v4 + design tokens (light/dark)
  page.tsx                        landing
  (auth)/login/page.tsx           email+password, Google, forgot link
  (auth)/signup/page.tsx          name, email x2, password
  (auth)/forgot/page.tsx          request reset email
  (auth)/reset/page.tsx           set new password
  auth/callback/route.ts          OAuth / reset code exchange
  onboarding/page.tsx             name, goal, first course
  (app)/layout.tsx                auth + onboarding gate, providers, shell
  (app)/home/page.tsx
  (app)/planner/page.tsx
  (app)/notes/page.tsx
  (app)/notes/[id]/page.tsx
  (app)/flashcards/page.tsx
  (app)/flashcards/[deck]/page.tsx
  (app)/review/page.tsx
  (app)/focus/page.tsx
  (app)/progress/page.tsx
  (app)/settings/page.tsx
middleware.ts                     session refresh + auth redirect
components/
  shell/AppShell.tsx              sidebar (desktop) + bottom tabs (mobile)
  shell/OfflineBanner.tsx
  providers/ProfileProvider.tsx   profile context (timezone etc.)
  providers/ToastProvider.tsx     toast("Couldn't save.", retry)
  ui/PageHeader.tsx               title + actions slot (future "Scan")
  ui/Dialog.tsx                   minimal modal
  ui/CourseDot.tsx
  planner/TaskRow.tsx
  planner/QuickAdd.tsx
  planner/CourseBar.tsx           chips + add/edit/delete course
  planner/WeekGrid.tsx
  planner/ClassDialog.tsx
  notes/RichEditor.tsx
  notes/MarkdownView.tsx
  flashcards/CardFace.tsx
lib/
  types.ts
  colors.ts
  dates.ts  timetable.ts  quickAdd.ts  srs.ts  streak.ts  stats.ts  timer.ts
  ui/save.ts                      saveWithRollback
  ui/autosave.ts                  createAutosaver (framework-free)
  ui/useAutosave.ts
  ui/useOnline.ts
  supabase/client.ts  supabase/server.ts  supabase/middleware.ts
  data/util.ts  data/profile.ts  data/courses.ts  data/tasks.ts  data/classes.ts
  data/notes.ts  data/decks.ts  data/cards.ts  data/focus.ts  data/reviews.ts
supabase/migrations/20261001000000_init.sql
public/sounds/{rain,cafe,lofi}.mp3   (supplied by the user — see Task 14)
tests/unit/*.test.ts              pure logic (no DB)
tests/db/*.test.ts                RLS + data layer against local Supabase
e2e/*.spec.ts                     Playwright
```

---

### Task 1: Project scaffold, git, and test tooling

**Files:**
- Create: whole Next.js scaffold at repo root, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `tests/unit/smoke.test.ts`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` (unit), `npm run test:db` (DB tests), `npm run e2e` (Playwright); alias `@/` → repo root; env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 1: Initialise git and scaffold Next.js into a temp folder, then move it to the root** (the root already contains `docs/`, which `create-next-app` would refuse)

```bash
cd /c/Users/Fii/Desktop/study
git init
npx create-next-app@latest scaffold --ts --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --turbopack --yes
cp -r scaffold/. . && rm -rf scaffold
```

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm i @supabase/supabase-js @supabase/ssr date-fns date-fns-tz next-themes lucide-react katex react-markdown remark-gfm remark-math rehype-katex @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-list @tiptap/markdown @tiptap/extension-mathematics
npm i -D vitest jsdom @vitest/coverage-v8 @playwright/test supabase
npx playwright install chromium
```

Then verify the Tiptap packages resolved to the same major version (all must be `3.x`):

```bash
npm ls @tiptap/react @tiptap/starter-kit @tiptap/extension-list @tiptap/markdown @tiptap/extension-mathematics
```

Expected: every package listed at `3.x.y`. If `@tiptap/markdown` is missing from the registry, stop and report it — Task 15 depends on it.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'node:path'

export default defineConfig(() => ({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    env: loadEnv('test', process.cwd(), ''), // loads .env.test.local for DB tests
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 20000,
  },
}))
```

- [ ] **Step 4: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
```

- [ ] **Step 5: Add scripts to `package.json`** (keep the existing `dev`, `build`, `start`, `lint`)

```json
"test": "vitest run tests/unit",
"test:watch": "vitest tests/unit",
"test:db": "vitest run tests/db --mode test",
"e2e": "playwright test",
"db:start": "supabase start",
"db:reset": "supabase db reset"
```

- [ ] **Step 6: Create `.env.example` and add env files to `.gitignore`**

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-from-supabase-status
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Append to `.gitignore`:
```
.env*.local
/test-results
/playwright-report
/supabase/.temp
```

- [ ] **Step 7: Write a smoke test** `tests/unit/smoke.test.ts`

```ts
import { describe, it, expect } from 'vitest'

describe('tooling', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 8: Run tests and build**

Run: `npm test` → Expected: 1 passed.
Run: `npm run build` → Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Playwright"
```

---

### Task 2: Timezone-aware date helpers (`lib/dates.ts`, `lib/timetable.ts`)

**Files:**
- Create: `lib/types.ts`, `lib/dates.ts`, `lib/timetable.ts`
- Test: `tests/unit/dates.test.ts`, `tests/unit/timetable.test.ts`

**Interfaces:**
- Consumes: `date-fns-tz`
- Produces:
  - `type DayKey = string` (`'YYYY-MM-DD'`)
  - `localDayKey(d: Date | string, tz: string): DayKey`
  - `endOfLocalDay(key: DayKey, tz: string): Date`
  - `startOfLocalDay(key: DayKey, tz: string): Date`
  - `addDaysToKey(key: DayKey, n: number): DayKey`
  - `weekdayOfKey(key: DayKey): number` (0 = Sunday)
  - `localTimeHHMM(d: Date, tz: string): string` (`'HH:MM'`)
  - `bucketTasks<T extends { due_at: string | null; done_at: string | null }>(tasks: T[], tz: string, now: Date): { overdue: T[]; today: T[]; upcoming: T[]; noDate: T[] }`
  - `formatDue(dueAt: string, tz: string, now: Date): string` → `'Today' | 'Tomorrow' | 'Mon'..'Sun' | 'Oct 9'`
  - `weekKeysFor(key: DayKey): DayKey[]` (7 keys, Monday first)
  - `nextClass<C extends { day_of_week: number; start_time: string }>(classes: C[], tz: string, now: Date): { cls: C; dayKey: DayKey } | null`
  - All shared row types in `lib/types.ts` (below).

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export type TaskType = 'assignment' | 'exam' | 'reading' | 'other'
export type Priority = 'low' | 'normal' | 'high'
export type ClassKind = 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'other'
export type EditorMode = 'rich' | 'markdown'
export type ThemePref = 'light' | 'dark' | 'system'

export interface Profile {
  id: string
  display_name: string | null
  timezone: string
  daily_goal_minutes: number
  focus_minutes: number
  short_break_minutes: number
  long_break_minutes: number
  long_break_every: number
  default_editor_mode: EditorMode
  theme: ThemePref
  onboarded: boolean
}
export interface Course { id: string; name: string; color: string }
export interface Task {
  id: string; course_id: string | null; title: string; type: TaskType
  due_at: string | null; priority: Priority; done_at: string | null; created_at: string
}
export interface ClassSlot {
  id: string; course_id: string; day_of_week: number; start_time: string; end_time: string
  location: string | null; kind: ClassKind
}
export interface NoteSummary { id: string; course_id: string | null; title: string; updated_at: string }
export interface Note extends NoteSummary { content_md: string }
export interface Deck { id: string; course_id: string | null; name: string }
export interface DeckWithDue extends Deck { due: number; total: number }
export interface Card {
  id: string; deck_id: string; front: string; back: string; due_at: string
  interval_days: number; ease: number; reps: number; lapses: number
}
export interface Review { id: string; card_id: string; rating: 1 | 2 | 3 | 4; reviewed_at: string }
export interface FocusSession { id: string; started_at: string; ended_at: string; minutes: number; completed: boolean }
```

- [ ] **Step 2: Write the failing tests** `tests/unit/dates.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  localDayKey, endOfLocalDay, startOfLocalDay, addDaysToKey, weekdayOfKey,
  bucketTasks, formatDue, weekKeysFor, localTimeHHMM,
} from '@/lib/dates'

const NY = 'America/New_York'
const t = (id: string, due_at: string | null, done_at: string | null = null) => ({ id, due_at, done_at })

describe('localDayKey', () => {
  it('uses the local date, not UTC', () => {
    // 03:30 UTC on Oct 1 is 23:30 on Sep 30 in New York
    expect(localDayKey('2026-10-01T03:30:00Z', NY)).toBe('2026-09-30')
    expect(localDayKey('2026-10-01T03:30:00Z', 'UTC')).toBe('2026-10-01')
  })
})

describe('day boundaries', () => {
  it('endOfLocalDay handles DST end (US: Nov 1 2026)', () => {
    expect(endOfLocalDay('2026-11-01', NY).toISOString()).toBe('2026-11-02T04:59:59.000Z')
    expect(endOfLocalDay('2026-10-31', NY).toISOString()).toBe('2026-11-01T03:59:59.000Z')
  })
  it('startOfLocalDay', () => {
    expect(startOfLocalDay('2026-10-01', NY).toISOString()).toBe('2026-10-01T04:00:00.000Z')
  })
  it('addDaysToKey crosses months, years and DST', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToKey('2026-11-01', 1)).toBe('2026-11-02')
  })
  it('weekdayOfKey', () => {
    expect(weekdayOfKey('2026-10-01')).toBe(4) // Thursday
    expect(weekdayOfKey('2026-10-04')).toBe(0) // Sunday
  })
  it('localTimeHHMM', () => {
    expect(localTimeHHMM(new Date('2026-10-01T14:05:00Z'), NY)).toBe('10:05')
  })
})

describe('bucketTasks', () => {
  const now = new Date('2026-10-01T03:30:00Z') // Sep 30, 23:30 in NY
  it('puts a task due later the same local evening in today, even though UTC is already the next day', () => {
    const r = bucketTasks([t('a', '2026-10-01T03:45:00Z')], NY, now)
    expect(r.today.map(x => x.id)).toEqual(['a'])
  })
  it('splits overdue / today / upcoming / noDate and skips done tasks', () => {
    const r = bucketTasks([
      t('late', '2026-09-29T15:00:00Z'),
      t('today', '2026-09-30T20:00:00Z'),
      t('tomorrow', '2026-10-01T05:00:00Z'),
      t('none', null),
      t('done', '2026-09-29T15:00:00Z', '2026-09-29T16:00:00Z'),
    ], NY, now)
    expect(r.overdue.map(x => x.id)).toEqual(['late'])
    expect(r.today.map(x => x.id)).toEqual(['today'])
    expect(r.upcoming.map(x => x.id)).toEqual(['tomorrow'])
    expect(r.noDate.map(x => x.id)).toEqual(['none'])
  })
  it('sorts each bucket by due date', () => {
    const r = bucketTasks([t('b', '2026-10-05T12:00:00Z'), t('a', '2026-10-03T12:00:00Z')], NY, now)
    expect(r.upcoming.map(x => x.id)).toEqual(['a', 'b'])
  })
})

describe('formatDue', () => {
  const now = new Date('2026-10-01T14:00:00Z') // Thu Oct 1, 10:00 NY
  it('labels today, tomorrow, this week, later', () => {
    expect(formatDue('2026-10-02T03:59:00Z', NY, now)).toBe('Today')
    expect(formatDue('2026-10-02T15:00:00Z', NY, now)).toBe('Tomorrow')
    expect(formatDue('2026-10-05T15:00:00Z', NY, now)).toBe('Mon')
    expect(formatDue('2026-10-09T15:00:00Z', NY, now)).toBe('Oct 9')
    expect(formatDue('2026-09-29T15:00:00Z', NY, now)).toBe('Sep 29')
  })
})

describe('weekKeysFor', () => {
  it('returns Monday..Sunday containing the day', () => {
    expect(weekKeysFor('2026-10-01')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
    expect(weekKeysFor('2026-10-04')[0]).toBe('2026-09-28') // Sunday belongs to the week starting Monday before
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- dates` → Expected: FAIL, cannot resolve `@/lib/dates`.

- [ ] **Step 4: Implement `lib/dates.ts`**

```ts
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export type DayKey = string

export function localDayKey(d: Date | string, tz: string): DayKey {
  return formatInTimeZone(new Date(d), tz, 'yyyy-MM-dd')
}

export function startOfLocalDay(key: DayKey, tz: string): Date {
  return fromZonedTime(`${key}T00:00:00`, tz)
}

export function endOfLocalDay(key: DayKey, tz: string): Date {
  return fromZonedTime(`${key}T23:59:59`, tz)
}

export function addDaysToKey(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function weekdayOfKey(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function localTimeHHMM(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, 'HH:mm')
}

export function bucketTasks<T extends { due_at: string | null; done_at: string | null }>(
  tasks: T[], tz: string, now: Date,
) {
  const todayKey = localDayKey(now, tz)
  const out = { overdue: [] as T[], today: [] as T[], upcoming: [] as T[], noDate: [] as T[] }
  for (const task of tasks) {
    if (task.done_at) continue
    if (!task.due_at) { out.noDate.push(task); continue }
    const key = localDayKey(task.due_at, tz)
    if (key < todayKey) out.overdue.push(task)
    else if (key === todayKey) out.today.push(task)
    else out.upcoming.push(task)
  }
  const byDue = (a: T, b: T) => (a.due_at ?? '').localeCompare(b.due_at ?? '')
  out.overdue.sort(byDue); out.today.sort(byDue); out.upcoming.sort(byDue)
  return out
}

export function formatDue(dueAt: string, tz: string, now: Date): string {
  const todayKey = localDayKey(now, tz)
  const key = localDayKey(dueAt, tz)
  if (key === todayKey) return 'Today'
  if (key === addDaysToKey(todayKey, 1)) return 'Tomorrow'
  if (key > todayKey && key <= addDaysToKey(todayKey, 6)) return formatInTimeZone(new Date(dueAt), tz, 'EEE')
  return formatInTimeZone(new Date(dueAt), tz, 'MMM d')
}

export function weekKeysFor(key: DayKey): DayKey[] {
  const monday = addDaysToKey(key, -((weekdayOfKey(key) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i))
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- dates` → Expected: all pass.

- [ ] **Step 6: Write the failing test** `tests/unit/timetable.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { nextClass } from '@/lib/timetable'

const NY = 'America/New_York'
const c = (id: string, day_of_week: number, start_time: string) => ({ id, day_of_week, start_time })

describe('nextClass', () => {
  // Thu Oct 1 2026, 10:00 in New York
  const now = new Date('2026-10-01T14:00:00Z')
  it('returns a later class today', () => {
    const r = nextClass([c('a', 4, '09:00:00'), c('b', 4, '13:00:00')], NY, now)
    expect(r?.cls.id).toBe('b')
    expect(r?.dayKey).toBe('2026-10-01')
  })
  it('skips classes that already started today and finds the next day', () => {
    const r = nextClass([c('a', 4, '09:00:00'), c('fri', 5, '08:00:00')], NY, now)
    expect(r?.cls.id).toBe('fri')
    expect(r?.dayKey).toBe('2026-10-02')
  })
  it('wraps to next week for the same weekday', () => {
    const r = nextClass([c('a', 4, '09:00:00')], NY, now)
    expect(r?.dayKey).toBe('2026-10-08')
  })
  it('returns null with no classes', () => {
    expect(nextClass([], NY, now)).toBeNull()
  })
})
```

- [ ] **Step 7: Run to verify failure** — `npm test -- timetable` → FAIL (module missing).

- [ ] **Step 8: Implement `lib/timetable.ts`**

```ts
import { addDaysToKey, localDayKey, localTimeHHMM, weekdayOfKey, type DayKey } from './dates'

export function nextClass<C extends { day_of_week: number; start_time: string }>(
  classes: C[], tz: string, now: Date,
): { cls: C; dayKey: DayKey } | null {
  const todayKey = localDayKey(now, tz)
  const nowHHMM = localTimeHHMM(now, tz)
  for (let off = 0; off <= 7; off++) {
    const key = addDaysToKey(todayKey, off)
    const dow = weekdayOfKey(key)
    const candidates = classes
      .filter(c => c.day_of_week === dow && (off > 0 || c.start_time.slice(0, 5) > nowHHMM))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    if (candidates.length) return { cls: candidates[0], dayKey: key }
  }
  return null
}
```

- [ ] **Step 9: Run to verify pass** — `npm test` → all pass.

- [ ] **Step 10: Commit**

```bash
git add lib tests/unit
git commit -m "feat: timezone-aware date and timetable helpers"
```

---

### Task 3: Quick-add parser (`lib/quickAdd.ts`)

**Files:**
- Create: `lib/quickAdd.ts`
- Test: `tests/unit/quickAdd.test.ts`

**Interfaces:**
- Consumes: `localDayKey`, `addDaysToKey`, `weekdayOfKey`, `endOfLocalDay` from `lib/dates.ts`
- Produces: `parseQuickAdd(input: string, tz: string, now: Date): { title: string; dueAt: string | null }` — `dueAt` is the ISO string for 23:59:59 local on the parsed day.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { parseQuickAdd } from '@/lib/quickAdd'

const NY = 'America/New_York'
const now = new Date('2026-10-01T14:00:00Z') // Thu Oct 1 2026, 10:00 NY
const eod = (key: string) => {
  // 23:59:59 EDT = 03:59:59Z next day (before Nov 1)
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1, 3, 59, 59)).toISOString()
}

describe('parseQuickAdd', () => {
  it('parses a trailing weekday abbreviation', () => {
    expect(parseQuickAdd('Calc problem set fri', NY, now)).toEqual({ title: 'Calc problem set', dueAt: eod('2026-10-02') })
  })
  it('parses full weekday names and prefixes like "tues"', () => {
    expect(parseQuickAdd('Essay monday', NY, now).dueAt).toBe(eod('2026-10-05'))
    expect(parseQuickAdd('Lab report tues', NY, now).dueAt).toBe(eod('2026-10-06'))
  })
  it('treats today\'s weekday as today', () => {
    expect(parseQuickAdd('Read ch 4 thu', NY, now).dueAt).toBe(eod('2026-10-01'))
  })
  it('parses today / tomorrow / tmr', () => {
    expect(parseQuickAdd('Vocab today', NY, now).dueAt).toBe(eod('2026-10-01'))
    expect(parseQuickAdd('Vocab tomorrow', NY, now).dueAt).toBe(eod('2026-10-02'))
    expect(parseQuickAdd('Vocab tmr', NY, now).dueAt).toBe(eod('2026-10-02'))
  })
  it('parses "oct 9" and "9 oct"', () => {
    expect(parseQuickAdd('Midterm oct 9', NY, now)).toEqual({ title: 'Midterm', dueAt: eod('2026-10-09') })
    expect(parseQuickAdd('Midterm 9 October', NY, now).dueAt).toBe(eod('2026-10-09'))
  })
  it('rolls a past month/day into next year', () => {
    expect(parseQuickAdd('Final jan 15', NY, now).dueAt).toBe(new Date(Date.UTC(2027, 0, 16, 4, 59, 59)).toISOString())
  })
  it('keeps the full title and no date when there is no date word', () => {
    expect(parseQuickAdd('Read about lemons', NY, now)).toEqual({ title: 'Read about lemons', dueAt: null })
  })
  it('does not produce an empty title from a lone date word', () => {
    expect(parseQuickAdd('friday', NY, now)).toEqual({ title: 'friday', dueAt: null })
  })
  it('rejects impossible dates', () => {
    expect(parseQuickAdd('Thing feb 31', NY, now)).toEqual({ title: 'Thing feb 31', dueAt: null })
  })
  it('trims whitespace', () => {
    expect(parseQuickAdd('  Quiz   fri  ', NY, now).title).toBe('Quiz')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- quickAdd` → FAIL.

- [ ] **Step 3: Implement `lib/quickAdd.ts`**

```ts
import { addDaysToKey, endOfLocalDay, localDayKey, weekdayOfKey } from './dates'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

const prefixIndex = (list: string[], word: string) =>
  word.length >= 3 ? list.findIndex(full => full.startsWith(word)) : -1

function validKey(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

export function parseQuickAdd(input: string, tz: string, now: Date): { title: string; dueAt: string | null } {
  const words = input.trim().split(/\s+/).filter(Boolean)
  const todayKey = localDayKey(now, tz)
  const done = (titleWords: string[], key: string) =>
    ({ title: titleWords.join(' '), dueAt: endOfLocalDay(key, tz).toISOString() })

  if (words.length >= 3) {
    const a = words[words.length - 2].toLowerCase()
    const b = words[words.length - 1].toLowerCase()
    let month = prefixIndex(MONTHS, a), day = Number(b)
    if (month < 0 || !Number.isInteger(day)) { month = prefixIndex(MONTHS, b); day = Number(a) }
    if (month >= 0 && Number.isInteger(day)) {
      const year = Number(todayKey.slice(0, 4))
      let key = validKey(year, month, day)
      if (key && key < todayKey) key = validKey(year + 1, month, day)
      if (key) return done(words.slice(0, -2), key)
    }
  }

  if (words.length >= 2) {
    const last = words[words.length - 1].toLowerCase()
    const rest = words.slice(0, -1)
    if (last === 'today') return done(rest, todayKey)
    if (['tomorrow', 'tmr', 'tmrw'].includes(last)) return done(rest, addDaysToKey(todayKey, 1))
    const wd = prefixIndex(WEEKDAYS, last)
    if (wd >= 0) return done(rest, addDaysToKey(todayKey, (wd - weekdayOfKey(todayKey) + 7) % 7))
  }

  return { title: words.join(' '), dueAt: null }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- quickAdd` → all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/quickAdd.ts tests/unit/quickAdd.test.ts
git commit -m "feat: natural-language quick-add parser"
```

---

### Task 4: Spaced repetition (`lib/srs.ts`)

**Files:**
- Create: `lib/srs.ts`
- Test: `tests/unit/srs.test.ts`

**Interfaces:**
- Consumes: `Card` from `lib/types.ts`
- Produces:
  - `type Rating = 1 | 2 | 3 | 4` (Again, Hard, Good, Easy)
  - `interface SrsState { intervalDays: number; ease: number; reps: number; lapses: number; dueAt: string }`
  - `schedule(s: SrsState, rating: Rating, now: Date): SrsState`
  - `cardToState(c: Card): SrsState`
  - `stateToCardPatch(s: SrsState): Pick<Card, 'due_at' | 'interval_days' | 'ease' | 'reps' | 'lapses'>`
  - `formatInterval(ms: number): string` (`'<1m' | 'Nm' | 'Nh' | 'Nd' | 'Nmo' | 'Ny'`)
  - `previewIntervals(s: SrsState, now: Date): Record<Rating, string>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { schedule, formatInterval, previewIntervals, type SrsState, type Rating } from '@/lib/srs'

const now = new Date('2026-10-01T12:00:00Z')
const fresh: SrsState = { intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, dueAt: now.toISOString() }
const DAY = 86_400_000

describe('schedule', () => {
  it('new card: Good → 1 day, Easy → 4 days, Hard → 1 day', () => {
    expect(schedule(fresh, 3, now).intervalDays).toBe(1)
    expect(schedule(fresh, 4, now).intervalDays).toBe(4)
    expect(schedule(fresh, 2, now).intervalDays).toBe(1)
  })
  it('second Good → 6 days, then interval × ease', () => {
    const s1 = schedule(fresh, 3, now)
    const s2 = schedule(s1, 3, now)
    expect(s2.intervalDays).toBe(6)
    const s3 = schedule(s2, 3, now)
    expect(s3.intervalDays).toBe(15) // round(6 * 2.5)
  })
  it('Again resets reps, counts a lapse only for learned cards, lowers ease, due in 1 minute', () => {
    const learned = schedule(schedule(fresh, 3, now), 3, now)
    const r = schedule(learned, 1, now)
    expect(r.reps).toBe(0)
    expect(r.lapses).toBe(1)
    expect(r.ease).toBe(2.3)
    expect(new Date(r.dueAt).getTime() - now.getTime()).toBe(60_000)
    expect(schedule(fresh, 1, now).lapses).toBe(0)
  })
  it('ease never drops below 1.3', () => {
    let s = fresh
    for (let i = 0; i < 20; i++) s = schedule(s, 1, now)
    expect(s.ease).toBe(1.3)
  })
  it('dueAt = now + intervalDays', () => {
    const s = schedule(fresh, 4, now)
    expect(new Date(s.dueAt).getTime()).toBe(now.getTime() + 4 * DAY)
  })
  it('keeps Hard ≤ Good < Easy for any learned state', () => {
    const states: SrsState[] = [
      { ...fresh, reps: 1, intervalDays: 1 },
      { ...fresh, reps: 2, intervalDays: 6 },
      { ...fresh, reps: 5, intervalDays: 40, ease: 1.3 },
      { ...fresh, reps: 3, intervalDays: 10, ease: 3.1 },
    ]
    for (const s of states) {
      const [h, g, e] = ([2, 3, 4] as Rating[]).map(r => schedule(s, r, now).intervalDays)
      expect(h).toBeLessThanOrEqual(g)
      expect(g).toBeLessThan(e)
    }
  })
})

describe('formatInterval / previewIntervals', () => {
  it('formats', () => {
    expect(formatInterval(30_000)).toBe('<1m')
    expect(formatInterval(60_000)).toBe('1m')
    expect(formatInterval(3 * 3_600_000)).toBe('3h')
    expect(formatInterval(6 * DAY)).toBe('6d')
    expect(formatInterval(62 * DAY)).toBe('2mo')
    expect(formatInterval(400 * DAY)).toBe('1y')
  })
  it('previews all four ratings', () => {
    expect(previewIntervals(fresh, now)).toEqual({ 1: '1m', 2: '1d', 3: '1d', 4: '4d' })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- srs` → FAIL.

- [ ] **Step 3: Implement `lib/srs.ts`**

```ts
import type { Card } from './types'

export type Rating = 1 | 2 | 3 | 4
export interface SrsState { intervalDays: number; ease: number; reps: number; lapses: number; dueAt: string }

const DAY = 86_400_000
const MIN_EASE = 1.3
const AGAIN_DELAY_MS = 60_000
const round2 = (n: number) => Math.round(n * 100) / 100

export function schedule(s: SrsState, rating: Rating, now: Date): SrsState {
  if (rating === 1) {
    return {
      intervalDays: 0,
      ease: round2(Math.max(MIN_EASE, s.ease - 0.2)),
      reps: 0,
      lapses: s.reps > 0 ? s.lapses + 1 : s.lapses,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MS).toISOString(),
    }
  }
  const i = s.intervalDays
  const good = s.reps === 0 ? 1 : s.reps === 1 ? 6 : Math.max(i + 1, Math.round(i * s.ease))
  let ease = s.ease
  let interval: number
  if (rating === 2) {
    ease = Math.max(MIN_EASE, s.ease - 0.15)
    interval = s.reps === 0 ? 1 : Math.min(good, Math.max(i + 1, Math.round(i * 1.2)))
  } else if (rating === 3) {
    interval = good
  } else {
    ease = s.ease + 0.15
    interval = s.reps === 0 ? 4 : Math.max(good + 1, Math.round(good * 1.3))
  }
  return {
    intervalDays: interval,
    ease: round2(ease),
    reps: s.reps + 1,
    lapses: s.lapses,
    dueAt: new Date(now.getTime() + interval * DAY).toISOString(),
  }
}

export function cardToState(c: Card): SrsState {
  return { intervalDays: c.interval_days, ease: c.ease, reps: c.reps, lapses: c.lapses, dueAt: c.due_at }
}

export function stateToCardPatch(s: SrsState) {
  return { due_at: s.dueAt, interval_days: s.intervalDays, ease: s.ease, reps: s.reps, lapses: s.lapses }
}

export function formatInterval(ms: number): string {
  const min = ms / 60_000
  if (min < 1) return '<1m'
  if (min < 60) return `${Math.round(min)}m`
  const h = min / 60
  if (h < 24) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)}d`
  if (d < 365) return `${Math.round(d / 30)}mo`
  return `${Math.round(d / 365)}y`
}

export function previewIntervals(s: SrsState, now: Date): Record<Rating, string> {
  const out = {} as Record<Rating, string>
  for (const r of [1, 2, 3, 4] as Rating[]) {
    out[r] = formatInterval(new Date(schedule(s, r, now).dueAt).getTime() - now.getTime())
  }
  return out
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- srs` → all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/srs.ts tests/unit/srs.test.ts
git commit -m "feat: SM-2 spaced repetition scheduler"
```

---

### Task 5: Streaks and stats (`lib/streak.ts`, `lib/stats.ts`)

**Files:**
- Create: `lib/streak.ts`, `lib/stats.ts`
- Test: `tests/unit/streak.test.ts`, `tests/unit/stats.test.ts`

**Interfaces:**
- Consumes: `localDayKey`, `addDaysToKey` from `lib/dates.ts`
- Produces:
  - `dailyMinutes(sessions: { started_at: string; minutes: number }[], tz: string): Map<DayKey, number>`
  - `computeStreak(sessions, goalMinutes: number, tz: string, now: Date): { current: number; best: number }`
  - `retention(reviews: { rating: number }[]): number | null` (0–1, null when no reviews)
  - `countByDay(isoDates: string[], tz: string): Map<DayKey, number>`

- [ ] **Step 1: Write the failing tests**

`tests/unit/streak.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeStreak, dailyMinutes } from '@/lib/streak'

const tz = 'UTC'
const s = (day: string, minutes: number) => ({ started_at: `${day}T10:00:00Z`, minutes })
const now = new Date('2026-10-10T15:00:00Z')

describe('dailyMinutes', () => {
  it('sums by local day', () => {
    const m = dailyMinutes([s('2026-10-09', 25), s('2026-10-09', 30), s('2026-10-10', 10)], tz)
    expect(m.get('2026-10-09')).toBe(55)
    expect(m.get('2026-10-10')).toBe(10)
  })
  it('attributes by the user timezone', () => {
    // 02:00Z on Oct 10 is Oct 9 in New York
    const m = dailyMinutes([{ started_at: '2026-10-10T02:00:00Z', minutes: 25 }], 'America/New_York')
    expect(m.get('2026-10-09')).toBe(25)
  })
})

describe('computeStreak', () => {
  it('counts consecutive goal-met days ending today', () => {
    const r = computeStreak([s('2026-10-08', 60), s('2026-10-09', 60), s('2026-10-10', 60)], 60, tz, now)
    expect(r.current).toBe(3)
  })
  it('does not break the streak just because today is not met yet', () => {
    const r = computeStreak([s('2026-10-08', 60), s('2026-10-09', 60), s('2026-10-10', 10)], 60, tz, now)
    expect(r.current).toBe(2)
  })
  it('is 0 when yesterday was missed and today not met', () => {
    expect(computeStreak([s('2026-10-08', 60)], 60, tz, now).current).toBe(0)
  })
  it('sums multiple sessions toward the goal', () => {
    expect(computeStreak([s('2026-10-10', 30), s('2026-10-10', 30)], 60, tz, now).current).toBe(1)
  })
  it('computes best streak across gaps', () => {
    const r = computeStreak([
      s('2026-09-01', 60), s('2026-09-02', 60), s('2026-09-03', 60), s('2026-09-04', 60),
      s('2026-10-10', 60),
    ], 60, tz, now)
    expect(r.best).toBe(4)
    expect(r.current).toBe(1)
  })
  it('treats a goal of 0 as 1 minute', () => {
    expect(computeStreak([s('2026-10-10', 1)], 0, tz, now).current).toBe(1)
  })
  it('handles no sessions', () => {
    expect(computeStreak([], 60, tz, now)).toEqual({ current: 0, best: 0 })
  })
})
```

`tests/unit/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { retention, countByDay } from '@/lib/stats'

describe('retention', () => {
  it('is the share of reviews rated Good or Easy', () => {
    expect(retention([{ rating: 1 }, { rating: 2 }, { rating: 3 }, { rating: 4 }])).toBe(0.5)
  })
  it('is null with no reviews', () => {
    expect(retention([])).toBeNull()
  })
})

describe('countByDay', () => {
  it('counts per local day', () => {
    const m = countByDay(['2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', '2026-10-02T10:00:00Z'], 'UTC')
    expect(m.get('2026-10-01')).toBe(2)
    expect(m.get('2026-10-02')).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- streak stats` → FAIL.

- [ ] **Step 3: Implement `lib/streak.ts`**

```ts
import { addDaysToKey, localDayKey, type DayKey } from './dates'

export function dailyMinutes(sessions: { started_at: string; minutes: number }[], tz: string): Map<DayKey, number> {
  const m = new Map<DayKey, number>()
  for (const s of sessions) {
    const k = localDayKey(s.started_at, tz)
    m.set(k, (m.get(k) ?? 0) + s.minutes)
  }
  return m
}

export function computeStreak(
  sessions: { started_at: string; minutes: number }[], goalMinutes: number, tz: string, now: Date,
): { current: number; best: number } {
  const goal = Math.max(1, goalMinutes)
  const met = new Set([...dailyMinutes(sessions, tz)].filter(([, m]) => m >= goal).map(([k]) => k))

  const today = localDayKey(now, tz)
  let key = met.has(today) ? today : addDaysToKey(today, -1)
  let current = 0
  while (met.has(key)) { current++; key = addDaysToKey(key, -1) }

  let best = 0, run = 0, prev: string | null = null
  for (const k of [...met].sort()) {
    run = prev && addDaysToKey(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return { current, best }
}
```

- [ ] **Step 4: Implement `lib/stats.ts`**

```ts
import { localDayKey, type DayKey } from './dates'

export function retention(reviews: { rating: number }[]): number | null {
  if (!reviews.length) return null
  return reviews.filter(r => r.rating >= 3).length / reviews.length
}

export function countByDay(isoDates: string[], tz: string): Map<DayKey, number> {
  const m = new Map<DayKey, number>()
  for (const d of isoDates) {
    const k = localDayKey(d, tz)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}
```

- [ ] **Step 5: Run to verify pass** — `npm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/streak.ts lib/stats.ts tests/unit/streak.test.ts tests/unit/stats.test.ts
git commit -m "feat: focus streak and review stats"
```

---

### Task 6: Pomodoro timer logic (`lib/timer.ts`)

**Files:**
- Create: `lib/timer.ts`
- Test: `tests/unit/timer.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Mode = 'focus' | 'short' | 'long'`
  - `interface TimerState { mode: Mode; durationMs: number; startedAt: number | null; accumulatedMs: number; firstStartedAt: number | null; logged: boolean }`
  - `createTimer(mode: Mode, durationMs: number): TimerState`
  - `startTimer(s, now: number): TimerState`, `pauseTimer(s, now: number): TimerState`
  - `elapsedMs(s, now: number): number`, `remainingMs(s, now: number): number`, `isFinished(s, now: number): boolean`
  - `nextMode(mode: Mode, completedFocusCount: number, longBreakEvery: number): Mode`
  - `shouldLogSession(s: TimerState, now: number): boolean` — focus mode, not already logged, and finished or elapsed ≥ 5 min
  - `markLogged(s: TimerState): TimerState`
  - `durationFor(mode: Mode, p: { focus_minutes: number; short_break_minutes: number; long_break_minutes: number }): number`
  - `MIN_LOG_MS = 300_000`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import {
  createTimer, startTimer, pauseTimer, elapsedMs, remainingMs, isFinished,
  nextMode, shouldLogSession, markLogged, durationFor, MIN_LOG_MS,
} from '@/lib/timer'

const MIN = 60_000
const T0 = 1_000_000

describe('timer', () => {
  it('counts from timestamps, so long gaps (sleep/tab hidden) are handled', () => {
    const s = startTimer(createTimer('focus', 25 * MIN), T0)
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(remainingMs(s, T0 + 3 * 60 * MIN)).toBe(0) // laptop slept for 3h
    expect(isFinished(s, T0 + 3 * 60 * MIN)).toBe(true)
  })
  it('pause freezes elapsed time; resume continues', () => {
    let s = startTimer(createTimer('focus', 25 * MIN), T0)
    s = pauseTimer(s, T0 + 5 * MIN)
    expect(elapsedMs(s, T0 + 50 * MIN)).toBe(5 * MIN)
    s = startTimer(s, T0 + 50 * MIN)
    expect(elapsedMs(s, T0 + 52 * MIN)).toBe(7 * MIN)
    expect(s.firstStartedAt).toBe(T0)
  })
  it('start and pause are idempotent', () => {
    const s = startTimer(createTimer('focus', MIN), T0)
    expect(startTimer(s, T0 + 999)).toBe(s)
    const p = pauseTimer(s, T0 + 10)
    expect(pauseTimer(p, T0 + 20)).toBe(p)
  })
})

describe('nextMode', () => {
  it('long break after every Nth focus session, short otherwise, focus after breaks', () => {
    expect(nextMode('focus', 1, 4)).toBe('short')
    expect(nextMode('focus', 4, 4)).toBe('long')
    expect(nextMode('focus', 8, 4)).toBe('long')
    expect(nextMode('short', 1, 4)).toBe('focus')
    expect(nextMode('long', 4, 4)).toBe('focus')
  })
})

describe('logging', () => {
  it('logs a finished focus session exactly once', () => {
    let s = startTimer(createTimer('focus', 25 * MIN), T0)
    const end = T0 + 25 * MIN
    expect(shouldLogSession(s, end)).toBe(true)
    s = markLogged(s)
    expect(shouldLogSession(s, end + 10 * MIN)).toBe(false)
  })
  it('logs an early stop only at ≥ 5 minutes', () => {
    const s = startTimer(createTimer('focus', 25 * MIN), T0)
    expect(shouldLogSession(s, T0 + MIN_LOG_MS - 1)).toBe(false)
    expect(shouldLogSession(s, T0 + MIN_LOG_MS)).toBe(true)
  })
  it('never logs breaks', () => {
    const s = startTimer(createTimer('short', 5 * MIN), T0)
    expect(shouldLogSession(s, T0 + 5 * MIN)).toBe(false)
  })
})

describe('durationFor', () => {
  it('maps profile minutes', () => {
    const p = { focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15 }
    expect(durationFor('focus', p)).toBe(25 * MIN)
    expect(durationFor('short', p)).toBe(5 * MIN)
    expect(durationFor('long', p)).toBe(15 * MIN)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- timer` → FAIL.

- [ ] **Step 3: Implement `lib/timer.ts`**

```ts
export type Mode = 'focus' | 'short' | 'long'
export interface TimerState {
  mode: Mode
  durationMs: number
  startedAt: number | null
  accumulatedMs: number
  firstStartedAt: number | null
  logged: boolean
}

export const MIN_LOG_MS = 5 * 60_000

export function createTimer(mode: Mode, durationMs: number): TimerState {
  return { mode, durationMs, startedAt: null, accumulatedMs: 0, firstStartedAt: null, logged: false }
}

export function startTimer(s: TimerState, now: number): TimerState {
  if (s.startedAt !== null) return s
  return { ...s, startedAt: now, firstStartedAt: s.firstStartedAt ?? now }
}

export function pauseTimer(s: TimerState, now: number): TimerState {
  if (s.startedAt === null) return s
  return { ...s, startedAt: null, accumulatedMs: s.accumulatedMs + (now - s.startedAt) }
}

export function elapsedMs(s: TimerState, now: number): number {
  return Math.min(s.durationMs, s.accumulatedMs + (s.startedAt === null ? 0 : now - s.startedAt))
}

export function remainingMs(s: TimerState, now: number): number {
  return Math.max(0, s.durationMs - elapsedMs(s, now))
}

export function isFinished(s: TimerState, now: number): boolean {
  return remainingMs(s, now) === 0
}

export function nextMode(mode: Mode, completedFocusCount: number, longBreakEvery: number): Mode {
  if (mode !== 'focus') return 'focus'
  return completedFocusCount > 0 && completedFocusCount % Math.max(1, longBreakEvery) === 0 ? 'long' : 'short'
}

export function shouldLogSession(s: TimerState, now: number): boolean {
  if (s.mode !== 'focus' || s.logged) return false
  return isFinished(s, now) || elapsedMs(s, now) >= MIN_LOG_MS
}

export function markLogged(s: TimerState): TimerState {
  return { ...s, logged: true }
}

export function durationFor(
  mode: Mode, p: { focus_minutes: number; short_break_minutes: number; long_break_minutes: number },
): number {
  const min = mode === 'focus' ? p.focus_minutes : mode === 'short' ? p.short_break_minutes : p.long_break_minutes
  return min * 60_000
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- timer` → all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/timer.ts tests/unit/timer.test.ts
git commit -m "feat: timestamp-based pomodoro timer logic"
```

---

### Task 7: Database schema, row-level security, and RLS tests

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261001000000_init.sql`, `tests/db/helpers.ts`, `tests/db/rls.test.ts`, `.env.test.local` (not committed)

**Interfaces:**
- Consumes: nothing
- Produces: tables `profiles, courses, tasks, classes, notes, decks, cards, reviews, focus_sessions` exactly as named in `lib/types.ts`; `user_id` defaults to `auth.uid()` so inserts never pass it; profile row auto-created on signup (reads `raw_user_meta_data.full_name` and `.timezone`); test helper `newUser(): Promise<{ sb: SupabaseClient; id: string }>`.

**Prerequisite:** Docker Desktop installed and running (the local Supabase stack runs in Docker).

- [ ] **Step 1: Initialise and start local Supabase**

```bash
npx supabase init
npx supabase start
```

Expected: prints `API URL: http://127.0.0.1:54321` and an `anon key`. In `supabase/config.toml` confirm `[auth.email] enable_confirmations = false` (set it if not). Create `.env.local` **and** `.env.test.local`, both with:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key printed by supabase start>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Write the failing RLS tests**

`tests/db/helpers.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export async function newUser(): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `t-${crypto.randomUUID()}@example.test`
  const { data, error } = await sb.auth.signUp({
    email, password: 'local-test-pass-123',
    options: { data: { full_name: 'Test', timezone: 'America/New_York' } },
  })
  if (error || !data.user) throw error ?? new Error('no user')
  return { sb, id: data.user.id }
}
```

`tests/db/rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
let courseId: string
let deckId: string

beforeAll(async () => {
  A = await newUser()
  B = await newUser()
  const c = await A.sb.from('courses').insert({ name: 'Biology', color: '#1D9E75' }).select('id').single()
  if (c.error) throw c.error
  courseId = c.data.id
  const d = await A.sb.from('decks').insert({ name: 'Cells', course_id: courseId }).select('id').single()
  if (d.error) throw d.error
  deckId = d.data.id
})

describe('profiles', () => {
  it('are created on signup with metadata', async () => {
    const { data } = await A.sb.from('profiles').select('*').eq('id', A.id).single()
    expect(data?.display_name).toBe('Test')
    expect(data?.timezone).toBe('America/New_York')
    expect(data?.onboarded).toBe(false)
  })
  it('are not readable by other users', async () => {
    const { data } = await B.sb.from('profiles').select('id').eq('id', A.id)
    expect(data).toEqual([])
  })
})

describe('row-level security', () => {
  it('B cannot read A\'s courses', async () => {
    const { data } = await B.sb.from('courses').select('id').eq('id', courseId)
    expect(data).toEqual([])
  })
  it('B cannot update A\'s courses', async () => {
    const { data } = await B.sb.from('courses').update({ name: 'hacked' }).eq('id', courseId).select('id')
    expect(data).toEqual([])
    const { data: still } = await A.sb.from('courses').select('name').eq('id', courseId).single()
    expect(still?.name).toBe('Biology')
  })
  it('B cannot delete A\'s courses', async () => {
    await B.sb.from('courses').delete().eq('id', courseId)
    const { data } = await A.sb.from('courses').select('id').eq('id', courseId)
    expect(data).toHaveLength(1)
  })
  it('B cannot insert rows owned by A', async () => {
    const { error } = await B.sb.from('courses').insert({ name: 'x', color: '#000000', user_id: A.id })
    expect(error).not.toBeNull()
  })
  it('B cannot attach a task to A\'s course', async () => {
    const { error } = await B.sb.from('tasks').insert({ title: 'x', course_id: courseId })
    expect(error).not.toBeNull()
  })
  it('B cannot add a card to A\'s deck', async () => {
    const { error } = await B.sb.from('cards').insert({ deck_id: deckId, front: 'q', back: 'a' })
    expect(error).not.toBeNull()
  })
  it('every table hides A\'s rows from B', async () => {
    await A.sb.from('tasks').insert({ title: 't', course_id: courseId })
    await A.sb.from('notes').insert({ title: 'n', content_md: 'x' })
    await A.sb.from('focus_sessions').insert({ started_at: new Date().toISOString(), ended_at: new Date().toISOString(), minutes: 25, completed: true })
    for (const table of ['tasks', 'notes', 'decks', 'cards', 'reviews', 'focus_sessions', 'classes']) {
      const { data, error } = await B.sb.from(table).select('id')
      expect(error, table).toBeNull()
      expect(data, table).toEqual([])
    }
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm run test:db` → Expected: FAIL (`relation "public.courses" does not exist` or similar).

- [ ] **Step 4: Write the migration** `supabase/migrations/20261001000000_init.sql`

```sql
-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  daily_goal_minutes int not null default 120 check (daily_goal_minutes between 1 and 1440),
  focus_minutes int not null default 25 check (focus_minutes between 1 and 180),
  short_break_minutes int not null default 5 check (short_break_minutes between 1 and 60),
  long_break_minutes int not null default 15 check (long_break_minutes between 1 and 120),
  long_break_every int not null default 4 check (long_break_every between 1 and 12),
  default_editor_mode text not null default 'rich' check (default_editor_mode in ('rich','markdown')),
  theme text not null default 'system' check (theme in ('light','dark','system')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Content tables ---------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null check (length(title) between 1 and 300),
  type text not null default 'other' check (type in ('assignment','exam','reading','other')),
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_user_due on public.tasks (user_id, due_at);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  location text,
  kind text not null default 'lecture' check (kind in ('lecture','lab','tutorial','seminar','other')),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null default 'Untitled',
  content_md text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid not null references public.decks on delete cascade,
  front text not null,
  back text not null,
  due_at timestamptz not null default now(),
  interval_days int not null default 0,
  ease real not null default 2.5,
  reps int not null default 0,
  lapses int not null default 0,
  created_at timestamptz not null default now()
);
create index cards_user_due on public.cards (user_id, due_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  rating int not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  prev_interval_days int not null,
  new_interval_days int not null,
  created_at timestamptz not null default now()
);
create index reviews_user_time on public.reviews (user_id, reviewed_at);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes int not null check (minutes between 0 and 600),
  completed boolean not null,
  created_at timestamptz not null default now()
);
create index focus_user_time on public.focus_sessions (user_id, started_at);

-- Ownership helpers (security definer so they can read across RLS) -------
create function public.owns_course(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select cid is null or exists (select 1 from public.courses c where c.id = cid and c.user_id = auth.uid())
$$;
create function public.owns_deck(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.decks d where d.id = did and d.user_id = auth.uid())
$$;
create function public.owns_card(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cards c where c.id = cid and c.user_id = auth.uid())
$$;

-- RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.courses enable row level security;
create policy "own rows" on public.courses for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.tasks enable row level security;
create policy "own rows" on public.tasks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.classes enable row level security;
create policy "own rows" on public.classes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.notes enable row level security;
create policy "own rows" on public.notes for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.decks enable row level security;
create policy "own rows" on public.decks for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id));

alter table public.cards enable row level security;
create policy "own rows" on public.cards for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_deck(deck_id));

alter table public.reviews enable row level security;
create policy "own rows" on public.reviews for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_card(card_id));

alter table public.focus_sessions enable row level security;
create policy "own rows" on public.focus_sessions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
```

- [ ] **Step 5: Apply and run tests**

Run: `npm run db:reset` → Expected: migration applies without error.
Run: `npm run test:db` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add supabase tests/db
git commit -m "feat: database schema with row-level security and RLS tests"
```

---

### Task 8: Supabase clients, auth pages, middleware, and onboarding

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `app/auth/callback/route.ts`, `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/forgot/page.tsx`, `app/(auth)/reset/page.tsx`, `app/onboarding/page.tsx`, `lib/colors.ts`
- Modify: `app/page.tsx` (landing)

**Interfaces:**
- Consumes: DB from Task 7
- Produces:
  - `supabase(): SupabaseClient` (browser singleton, `lib/supabase/client.ts`)
  - `createServerSupabase(): Promise<SupabaseClient>` (`lib/supabase/server.ts`)
  - `COURSE_COLORS: string[]` (`lib/colors.ts`)
  - Routes `/login?next=`, `/signup`, `/forgot`, `/reset`, `/auth/callback?code=&next=`, `/onboarding`
  - `APP_PATHS` protected prefixes: `/home /planner /notes /flashcards /review /focus /progress /settings /onboarding`

- [ ] **Step 1: Supabase clients**

`lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  return client
}
```

`lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* called from a Server Component; middleware refreshes the session */ }
      },
    },
  })
}
```

`lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const APP_PATHS = ['/home', '/planner', '/notes', '/flashcards', '/review', '/focus', '/progress', '/settings', '/onboarding']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await sb.auth.getUser()
  const path = request.nextUrl.pathname
  if (!user && APP_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return NextResponse.redirect(url)
  }
  if (user && (path === '/login' || path === '/signup' || path === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}
```

`middleware.ts`:
```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)'],
}
```

- [ ] **Step 2: OAuth / reset callback** `app/auth/callback/route.ts`

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home'
  if (code) {
    const sb = await createServerSupabase()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`)
  }
  return NextResponse.redirect(`${origin}/login?error=callback`)
}
```

- [ ] **Step 3: Colors and auth layout**

`lib/colors.ts`:
```ts
export const COURSE_COLORS = ['#1D9E75', '#7F77DD', '#D85A30', '#BA7517', '#378ADD', '#D4537E', '#639922', '#888780']
```

`app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
```

- [ ] **Step 4: Login page** `app/(auth)/login/page.tsx`

```tsx
'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/home'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase().auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) { setError('That email and password don\'t match. Try again.'); return }
    router.replace(next)
    router.refresh()
  }

  async function google() {
    await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium">Log in</h1>
      <button type="button" onClick={google} className="btn w-full">Continue with Google</button>
      <div className="text-center text-xs text-muted">or</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="field"><span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/forgot" className="text-muted hover:text-fg">Forgot password</Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent">Create account</Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
```

- [ ] **Step 5: Signup page** `app/(auth)/signup/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) { setError('Those emails don\'t match.'); return }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return }
    setBusy(true); setError(null)
    const { error } = await supabase().auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
    })
    setBusy(false)
    if (error) { setError(error.message.includes('registered') ? 'That email already has an account. Log in instead.' : 'Couldn\'t create your account. Try again.'); return }
    router.replace('/onboarding')
    router.refresh()
  }

  async function google() {
    await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/home` },
    })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium">Create your account</h1>
      <button type="button" onClick={google} className="btn w-full">Continue with Google</button>
      <div className="text-center text-xs text-muted">or</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="field"><span>Name</span>
          <input autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ama" />
        </label>
        <label className="field"><span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setError(null) }} />
        </label>
        <label className="field"><span>Confirm email</span>
          <input type="email" required autoComplete="off" value={email2} onChange={e => { setEmail2(e.target.value); setError(null) }} onPaste={e => e.preventDefault()} />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="text-sm text-muted">Already have an account? <Link href="/login" className="text-accent">Log in</Link></p>
    </div>
  )
}
```

- [ ] **Step 6: Forgot and reset pages**

`app/(auth)/forgot/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
    })
    setSent(true) // same message whether or not the account exists
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Reset your password</h1>
      {sent ? <p className="text-sm text-muted">If that email has an account, a reset link is on its way.</p> : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="field"><span>Email</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <button className="btn-primary w-full">Send reset link</button>
        </form>
      )}
      <Link href="/login" className="text-sm text-accent">Back to log in</Link>
    </div>
  )
}
```

`app/(auth)/reset/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function ResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    const { error } = await supabase().auth.updateUser({ password })
    if (error) { setError('Couldn\'t update your password. Request a new link.'); return }
    router.replace('/home')
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h1 className="text-xl font-medium">Choose a new password</h1>
      <label className="field"><span>New password</span>
        <input type="password" required minLength={8} value={password} onChange={e => { setPassword(e.target.value); setError(null) }} />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full">Save password</button>
    </form>
  )
}
```

Add `/reset` to protected handling: it needs a session (set by the callback); if no session, the update fails and the error tells the user to request a new link — acceptable.

- [ ] **Step 7: Onboarding** `app/onboarding/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { COURSE_COLORS } from '@/lib/colors'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [goalHours, setGoalHours] = useState('2')
  const [course, setCourse] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish(skip: boolean) {
    setBusy(true); setError(null)
    const sb = supabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const patch: Record<string, unknown> = { onboarded: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    if (!skip) {
      if (name.trim()) patch.display_name = name.trim()
      const h = Number(goalHours)
      if (Number.isFinite(h) && h > 0 && h <= 24) patch.daily_goal_minutes = Math.round(h * 60)
    }
    const { error } = await sb.from('profiles').update(patch).eq('id', user.id)
    if (!error && !skip && course.trim()) {
      await sb.from('courses').insert({ name: course.trim(), color: COURSE_COLORS[0] })
    }
    setBusy(false)
    if (error) { setError('Couldn\'t save. Try again.'); return }
    router.replace('/home')
    router.refresh()
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-medium">Let's set things up</h1>
        <label className="field"><span>What should we call you?</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ama" />
        </label>
        <label className="field"><span>Daily focus goal (hours)</span>
          <input type="number" min="0.25" max="24" step="0.25" value={goalHours} onChange={e => setGoalHours(e.target.value)} />
        </label>
        <label className="field"><span>Your first course</span>
          <input value={course} onChange={e => setCourse(e.target.value)} placeholder="Biology" />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => finish(false)} className="btn-primary flex-1">Continue</button>
          <button disabled={busy} onClick={() => finish(true)} className="btn">Skip</button>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Landing page** — replace `app/page.tsx`

```tsx
import Link from 'next/link'

export default function Landing() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-medium">Studyhub</h1>
      <p className="max-w-md text-muted">Plan your courses, keep your timetable, take notes, review flashcards, and focus — all in one calm place.</p>
      <div className="flex gap-3">
        <Link href="/signup" className="btn-primary">Get started</Link>
        <Link href="/login" className="btn">Log in</Link>
      </div>
    </main>
  )
}
```

(The `.btn`, `.btn-primary`, `.field`, `text-muted`, `text-danger`, `text-accent` styles come from Task 9's `globals.css`; pages render unstyled but functional until then.)

- [ ] **Step 9: Manual Google OAuth setup (user does this; do not enter credentials on their behalf)**

Tell the user: in Google Cloud Console create an OAuth client (Web), add redirect URI `http://127.0.0.1:54321/auth/v1/callback` (local) and later the hosted Supabase callback URL; then put the client ID/secret in `supabase/config.toml` under `[auth.external.google]` (`enabled = true`, `client_id = "env(GOOGLE_CLIENT_ID)"`, `secret = "env(GOOGLE_CLIENT_SECRET)"`) with the values in their own shell env, and add `http://localhost:3000/auth/callback` to `[auth] additional_redirect_urls`. Email/password works without this step.

- [ ] **Step 10: Verify manually**

Run: `npm run dev`. Visit `/home` while logged out → redirected to `/login?next=%2Fhome`. Sign up at `/signup` with mismatched emails → error "Those emails don't match." Sign up properly → lands on `/onboarding` → Continue → `/home` (404 is expected until Task 9). Run `npm run build` → succeeds.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: email and Google auth, middleware redirects, onboarding"
```

---

### Task 9: App shell, theming, toasts, offline banner, and save helper

**Files:**
- Create: `lib/data/util.ts` and `lib/data/profile.ts` (exact code in Task 10 Step 3 — write those two files now; the shell's theme toggle needs `updateProfile`), `app/(app)/layout.tsx`, `app/(app)/home/page.tsx` (temporary stub, replaced in Task 11), `components/shell/AppShell.tsx`, `components/shell/OfflineBanner.tsx`, `components/providers/ProfileProvider.tsx`, `components/providers/ToastProvider.tsx`, `components/ui/PageHeader.tsx`, `components/ui/Dialog.tsx`, `components/ui/CourseDot.tsx`, `lib/ui/save.ts`, `lib/ui/useOnline.ts`
- Modify: `app/layout.tsx`, `app/globals.css`
- Test: `tests/unit/save.test.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `Profile`
- Produces:
  - `useProfile(): { profile: Profile; setProfile: (p: Profile) => void }`
  - `useToast(): (message: string, action?: { label: string; onClick: () => void }) => void`
  - `saveWithRollback(opts: { apply: () => void; rollback: () => void; run: () => Promise<unknown>; onFail: (retry: () => void) => void; isOnline?: () => boolean; onReconnect?: (cb: () => void) => void }): Promise<void>`
  - `useSaver(): (apply, rollback, run) => Promise<void>` — wraps `saveWithRollback` with the toast `Couldn't save.` + `Retry`
  - `useOnline(): boolean`
  - `<PageHeader title actions? />`, `<Dialog open onClose title>`, `<CourseDot color />`
  - CSS utility classes: `btn`, `btn-primary`, `btn-ghost`, `field`, `card`, `pill`, colors `bg-bg bg-surface border-line text-fg text-muted text-accent bg-accent-soft text-danger bg-danger-soft`

- [ ] **Step 1: Write the failing test for `saveWithRollback`** `tests/unit/save.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { saveWithRollback } from '@/lib/ui/save'

describe('saveWithRollback', () => {
  it('applies immediately and keeps the change on success', async () => {
    const log: string[] = []
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { log.push('run') }, onFail: () => log.push('fail'), isOnline: () => true,
    })
    expect(log).toEqual(['apply', 'run'])
  })
  it('rolls back and reports failure when online', async () => {
    const log: string[] = []
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { throw new Error('x') }, onFail: () => log.push('fail'), isOnline: () => true,
    })
    expect(log).toEqual(['apply', 'rollback', 'fail'])
  })
  it('keeps the change while offline and retries once on reconnect', async () => {
    const log: string[] = []
    let reconnect: (() => void) | null = null
    let attempts = 0
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { attempts++; if (attempts === 1) throw new Error('offline') },
      onFail: () => log.push('fail'), isOnline: () => false, onReconnect: cb => { reconnect = cb },
    })
    expect(log).toEqual(['apply'])
    reconnect!()
    await vi.waitFor(() => expect(attempts).toBe(2))
    expect(log).toEqual(['apply'])
  })
  it('rolls back if the reconnect retry also fails', async () => {
    const log: string[] = []
    let reconnect: (() => void) | null = null
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { throw new Error('x') }, onFail: () => log.push('fail'),
      isOnline: () => false, onReconnect: cb => { reconnect = cb },
    })
    reconnect!()
    await vi.waitFor(() => expect(log).toEqual(['apply', 'rollback', 'fail']))
  })
  it('retry re-applies and re-runs', async () => {
    let retry: (() => void) | null = null
    let runs = 0
    await saveWithRollback({
      apply: () => {}, rollback: () => {},
      run: async () => { runs++; if (runs === 1) throw new Error('x') },
      onFail: r => { retry = r }, isOnline: () => true,
    })
    retry!()
    await vi.waitFor(() => expect(runs).toBe(2))
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- save` → FAIL.

- [ ] **Step 3: Implement `lib/ui/save.ts`**

```ts
export interface SaveOpts {
  apply: () => void
  rollback: () => void
  run: () => Promise<unknown>
  onFail: (retry: () => void) => void
  isOnline?: () => boolean
  onReconnect?: (cb: () => void) => void
}

const defaultOnline = () => typeof navigator === 'undefined' || navigator.onLine
const defaultReconnect = (cb: () => void) => window.addEventListener('online', cb, { once: true })

export async function saveWithRollback(opts: SaveOpts): Promise<void> {
  const isOnline = opts.isOnline ?? defaultOnline
  const onReconnect = opts.onReconnect ?? defaultReconnect
  const retry = () => { void saveWithRollback(opts) }
  opts.apply()
  try {
    await opts.run()
  } catch {
    if (!isOnline()) {
      onReconnect(() => {
        opts.run().catch(() => { opts.rollback(); opts.onFail(retry) })
      })
      return
    }
    opts.rollback()
    opts.onFail(retry)
  }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- save` → all pass.

- [ ] **Step 5: Replace `app/globals.css`**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --bg: #ffffff; --surface: #f6f6f4; --line: #e6e5e0; --fg: #1f1f1d; --muted: #6b6a65;
  --accent: #2f6fde; --accent-soft: #e6f0fb; --danger: #c43c3c; --danger-soft: #fcebeb;
}
.dark {
  --bg: #141413; --surface: #1d1d1b; --line: #2e2e2b; --fg: #ededea; --muted: #9a9993;
  --accent: #6aa3f0; --accent-soft: #16304f; --danger: #f07b7b; --danger-soft: #3d1b1b;
}

@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-line: var(--line);
  --color-fg: var(--fg); --color-muted: var(--muted); --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft); --color-danger: var(--danger); --color-danger-soft: var(--danger-soft);
}

body { background: var(--bg); color: var(--fg); font-size: 14px; }

@layer components {
  .btn { @apply inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-60; }
  .btn-primary { @apply inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-60; }
  .btn-ghost { @apply inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface hover:text-fg; }
  .field { @apply flex flex-col gap-1 text-sm; }
  .field > span { @apply text-muted; }
  .field input, .field select, .field textarea, input.input, select.input, textarea.input {
    @apply rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent;
  }
  .card { @apply rounded-xl border border-line p-4; }
  .pill { @apply rounded-md bg-surface px-2 py-0.5 text-xs text-muted; }
}
```

- [ ] **Step 6: Root layout** — replace `app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import 'katex/dist/katex.min.css'
import './globals.css'

export const metadata: Metadata = { title: 'Studyhub', description: 'A calm study hub for students' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Providers**

`components/providers/ProfileProvider.tsx`:
```tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { Profile } from '@/lib/types'

const Ctx = createContext<{ profile: Profile; setProfile: (p: Profile) => void } | null>(null)

export function ProfileProvider({ initial, children }: { initial: Profile; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initial)
  const { setTheme } = useTheme()
  useEffect(() => { setTheme(initial.theme) }, [initial.theme, setTheme])
  return <Ctx.Provider value={{ profile, setProfile }}>{children}</Ctx.Provider>
}

export function useProfile() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile outside ProfileProvider')
  return v
}
```

`components/providers/ToastProvider.tsx`:
```tsx
'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { saveWithRollback } from '@/lib/ui/save'

type Action = { label: string; onClick: () => void }
type ToastFn = (message: string, action?: Action) => void
const Ctx = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; action?: Action } | null>(null)
  const show = useCallback<ToastFn>((message, action) => {
    const id = Date.now()
    setToast({ id, message, action })
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), 6000)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-fg px-4 py-2 text-sm text-bg md:bottom-6">
          {toast.message}
          {toast.action && (
            <button className="font-medium underline" onClick={() => { toast.action!.onClick(); setToast(null) }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)

export function useSaver() {
  const toast = useToast()
  return useCallback((apply: () => void, rollback: () => void, run: () => Promise<unknown>) =>
    saveWithRollback({ apply, rollback, run, onFail: retry => toast('Couldn\'t save.', { label: 'Retry', onClick: retry }) }),
  [toast])
}
```

- [ ] **Step 8: Online hook and banner**

`lib/ui/useOnline.ts`:
```ts
'use client'
import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb); window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
```

`components/shell/OfflineBanner.tsx`:
```tsx
'use client'
import { useOnline } from '@/lib/ui/useOnline'

export function OfflineBanner() {
  return useOnline() ? null : (
    <div role="status" className="bg-danger-soft px-4 py-1.5 text-center text-sm text-danger">You're offline</div>
  )
}
```

- [ ] **Step 9: UI primitives**

`components/ui/PageHeader.tsx`:
```tsx
export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  // `actions` is where the Phase 2 "Scan" button will go.
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-lg font-medium">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

`components/ui/Dialog.tsx`:
```tsx
'use client'
import { useEffect, useRef } from 'react'

export function Dialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(92vw,420px)] rounded-xl border border-line bg-bg p-5 text-fg backdrop:bg-black/40">
      <h2 className="mb-4 text-base font-medium">{title}</h2>
      {children}
    </dialog>
  )
}
```

`components/ui/CourseDot.tsx`:
```tsx
export function CourseDot({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--line)' }} />
}
```

- [ ] **Step 10: App shell** `components/shell/AppShell.tsx`

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Layers, Timer, NotebookPen, BarChart3, Settings, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { OfflineBanner } from './OfflineBanner'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'

const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
]
const MOBILE = NAV.slice(0, 5)

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { profile, setProfile } = useProfile()
  function toggleTheme() {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    // Persist so the choice survives reloads (ProfileProvider applies profile.theme on load)
    updateProfile(supabase(), profile.id, { theme: next }).then(setProfile).catch(() => {})
  }
  const active = (href: string) => path === href || path.startsWith(href + '/') || (href === '/flashcards' && path.startsWith('/review'))

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[180px_1fr]">
      <aside className="hidden border-r border-line bg-surface p-3 md:flex md:flex-col">
        <div className="mb-5 px-2 text-[15px] font-medium">Studyhub</div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${active(href) ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}`}>
              <Icon size={16} aria-hidden />{label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <button className="btn-ghost" onClick={toggleTheme}>
            {resolvedTheme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <Link href="/settings" className={`btn-ghost ${active('/settings') ? 'text-fg' : ''}`}><Settings size={16} aria-hidden />Settings</Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col pb-16 md:pb-0">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-4xl px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg md:hidden">
        {MOBILE.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(href) ? 'text-accent' : 'text-muted'}`}>
            <Icon size={18} aria-hidden />{label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
```

(On mobile, Progress and Settings are reached from links in the Home header — added in Task 11.)

- [ ] **Step 11: App layout with auth + onboarding gate** `app/(app)/layout.tsx`

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { AppShell } from '@/components/shell/AppShell'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single<Profile>()
  if (!profile) redirect('/login')
  if (!profile.onboarded) redirect('/onboarding')
  return (
    <ProfileProvider initial={profile}>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </ProfileProvider>
  )
}
```

Temporary `app/(app)/home/page.tsx` (replaced in Task 11):
```tsx
export default function HomePage() { return <p>Home</p> }
```

- [ ] **Step 12: Verify**

Run: `npm test` → all pass. Run: `npm run build` → succeeds. Run `npm run dev`, log in → `/home` shows the shell; theme toggle switches light/dark; DevTools "Offline" shows the "You're offline" banner; at 375px width the bottom tab bar replaces the sidebar.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: app shell, theming, toasts, offline banner, optimistic save helper"
```

---

### Task 10: Data layer (`lib/data/*`) with integration tests

**Files:**
- Create: `lib/data/util.ts`, `lib/data/profile.ts`, `lib/data/courses.ts`, `lib/data/tasks.ts`, `lib/data/classes.ts`, `lib/data/notes.ts`, `lib/data/decks.ts`, `lib/data/cards.ts`, `lib/data/focus.ts`, `lib/data/reviews.ts`
- Test: `tests/db/data.test.ts`

**Interfaces:**
- Consumes: `lib/types.ts`, `schedule`, `cardToState`, `stateToCardPatch`, `Rating` from `lib/srs.ts`
- Produces (every function takes `sb: SupabaseClient` first and throws on error):
  - `getProfile(sb, id): Promise<Profile>`; `updateProfile(sb, id, patch: Partial<Profile>): Promise<Profile>`
  - `listCourses(sb): Promise<Course[]>`; `createCourse(sb, { name, color }): Promise<Course>`; `updateCourse(sb, id, patch): Promise<void>`; `deleteCourse(sb, id, { deleteContents: boolean }): Promise<void>`
  - `listOpenTasks(sb): Promise<Task[]>`; `createTask(sb, NewTask): Promise<Task>`; `setTaskDone(sb, id, done: boolean): Promise<void>`; `updateTask(sb, id, patch): Promise<void>`; `deleteTask(sb, id): Promise<void>`; `type NewTask = { title: string; course_id?: string | null; type?: TaskType; due_at?: string | null; priority?: Priority }`
  - `listClasses(sb): Promise<ClassSlot[]>`; `createClass(sb, Omit<ClassSlot,'id'>): Promise<ClassSlot>`; `updateClass(sb, id, patch): Promise<void>`; `deleteClass(sb, id): Promise<void>`
  - `listNotes(sb): Promise<NoteSummary[]>`; `getNote(sb, id): Promise<Note>`; `createNote(sb, { title?, content_md?, course_id? }): Promise<Note>`; `updateNote(sb, id, patch: Partial<Pick<Note,'title'|'content_md'|'course_id'>>): Promise<void>`; `deleteNote(sb, id): Promise<void>`
  - `listDecksWithDue(sb, now: Date): Promise<DeckWithDue[]>`; `createDeck(sb, { name, course_id? }): Promise<Deck>`; `updateDeck(sb, id, patch): Promise<void>`; `deleteDeck(sb, id): Promise<void>`
  - `listCards(sb, deckId): Promise<Card[]>`; `createCards(sb, deckId, cards: { front: string; back: string }[]): Promise<Card[]>`; `updateCard(sb, id, patch: { front?: string; back?: string }): Promise<void>`; `deleteCard(sb, id): Promise<void>`; `listDueCards(sb, now: Date, deckId?: string, limit = 200): Promise<Card[]>`; `countDueCards(sb, now: Date): Promise<number>`; `rateCard(sb, card: Card, rating: Rating, now: Date): Promise<Card>`
  - `logFocusSession(sb, { startedAt: Date; endedAt: Date; minutes: number; completed: boolean }): Promise<void>`; `listSessionsSince(sb, since: Date): Promise<FocusSession[]>`
  - `listReviewsSince(sb, since: Date): Promise<Review[]>`

- [ ] **Step 1: Write the failing integration test** `tests/db/data.test.ts`

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createCourse, deleteCourse, listCourses } from '@/lib/data/courses'
import { createTask, listOpenTasks, setTaskDone } from '@/lib/data/tasks'
import { createClass, listClasses } from '@/lib/data/classes'
import { createNote, listNotes, getNote, updateNote } from '@/lib/data/notes'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import { createCards, listDueCards, rateCard, countDueCards } from '@/lib/data/cards'
import { listReviewsSince } from '@/lib/data/reviews'
import { logFocusSession, listSessionsSince } from '@/lib/data/focus'

let sb: SupabaseClient
beforeAll(async () => { sb = (await newUser()).sb })

describe('courses', () => {
  it('delete keeping contents: tasks/notes/decks lose their course, classes are removed', async () => {
    const c = await createCourse(sb, { name: 'Bio', color: '#1D9E75' })
    const t = await createTask(sb, { title: 'Read', course_id: c.id })
    await createClass(sb, { course_id: c.id, day_of_week: 1, start_time: '10:00', end_time: '11:00', location: null, kind: 'lecture' })
    const n = await createNote(sb, { title: 'Cells', course_id: c.id })
    await deleteCourse(sb, c.id, { deleteContents: false })
    expect((await listCourses(sb)).find(x => x.id === c.id)).toBeUndefined()
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)?.course_id).toBeNull()
    expect((await getNote(sb, n.id)).course_id).toBeNull()
    expect((await listClasses(sb)).filter(x => x.course_id === c.id)).toEqual([])
  })
  it('delete with contents removes tasks, notes and decks', async () => {
    const c = await createCourse(sb, { name: 'Chem', color: '#378ADD' })
    const t = await createTask(sb, { title: 'Lab', course_id: c.id })
    const n = await createNote(sb, { title: 'Acids', course_id: c.id })
    const d = await createDeck(sb, { name: 'Acids', course_id: c.id })
    await deleteCourse(sb, c.id, { deleteContents: true })
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)).toBeUndefined()
    expect((await listNotes(sb)).find(x => x.id === n.id)).toBeUndefined()
    expect((await listDecksWithDue(sb, new Date())).find(x => x.id === d.id)).toBeUndefined()
  })
})

describe('tasks', () => {
  it('done tasks drop out of open tasks and can be undone', async () => {
    const t = await createTask(sb, { title: 'Essay', due_at: '2026-10-02T03:59:59Z', type: 'assignment' })
    await setTaskDone(sb, t.id, true)
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)).toBeUndefined()
    await setTaskDone(sb, t.id, false)
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)).toBeDefined()
  })
})

describe('notes', () => {
  it('updates content and bumps updated_at', async () => {
    const n = await createNote(sb, {})
    expect(n.title).toBe('Untitled')
    await new Promise(r => setTimeout(r, 20))
    await updateNote(sb, n.id, { content_md: '# Hi $x^2$' })
    const after = await getNote(sb, n.id)
    expect(after.content_md).toBe('# Hi $x^2$')
    expect(after.updated_at > n.updated_at).toBe(true)
  })
})

describe('cards', () => {
  it('createCards inserts a batch that is immediately due', async () => {
    const d = await createDeck(sb, { name: 'Vocab' })
    const cards = await createCards(sb, d.id, [{ front: 'chat', back: 'cat' }, { front: 'chien', back: 'dog' }])
    expect(cards).toHaveLength(2)
    const due = await listDueCards(sb, new Date(Date.now() + 1000), d.id)
    expect(due).toHaveLength(2)
    const decks = await listDecksWithDue(sb, new Date(Date.now() + 1000))
    expect(decks.find(x => x.id === d.id)).toMatchObject({ due: 2, total: 2 })
  })
  it('rateCard reschedules and records a review', async () => {
    const d = await createDeck(sb, { name: 'Rate' })
    const [card] = await createCards(sb, d.id, [{ front: 'q', back: 'a' }])
    const now = new Date()
    const before = await countDueCards(sb, new Date(now.getTime() + 1000))
    const updated = await rateCard(sb, card, 4, now)
    expect(updated.interval_days).toBe(4)
    expect(updated.reps).toBe(1)
    expect(await countDueCards(sb, new Date(now.getTime() + 1000))).toBe(before - 1)
    const reviews = await listReviewsSince(sb, new Date(now.getTime() - 60_000))
    expect(reviews.find(r => r.card_id === card.id)?.rating).toBe(4)
  })
})

describe('focus', () => {
  it('logs and lists sessions', async () => {
    const start = new Date()
    await logFocusSession(sb, { startedAt: start, endedAt: new Date(start.getTime() + 25 * 60_000), minutes: 25, completed: true })
    const list = await listSessionsSince(sb, new Date(start.getTime() - 1000))
    expect(list.at(-1)).toMatchObject({ minutes: 25, completed: true })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm run test:db` → FAIL (modules missing).

- [ ] **Step 3: Implement `lib/data/util.ts`, `profile.ts` (already created in Task 9 — confirm they match), `courses.ts`, `tasks.ts`**

`lib/data/util.ts`:
```ts
import type { PostgrestError } from '@supabase/supabase-js'

export function must<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

export function check(res: { error: PostgrestError | null }): void {
  if (res.error) throw res.error
}
```

`lib/data/profile.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { must } from './util'

export async function getProfile(sb: SupabaseClient, id: string): Promise<Profile> {
  return must(await sb.from('profiles').select('*').eq('id', id).single<Profile>())
}

export async function updateProfile(sb: SupabaseClient, id: string, patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  return must(await sb.from('profiles').update(patch).eq('id', id).select('*').single<Profile>())
}
```

`lib/data/courses.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Course } from '../types'
import { check, must } from './util'

const COLS = 'id,name,color'

export async function listCourses(sb: SupabaseClient): Promise<Course[]> {
  return must(await sb.from('courses').select(COLS).order('created_at'))
}

export async function createCourse(sb: SupabaseClient, input: { name: string; color: string }): Promise<Course> {
  return must(await sb.from('courses').insert(input).select(COLS).single())
}

export async function updateCourse(sb: SupabaseClient, id: string, patch: Partial<Omit<Course, 'id'>>): Promise<void> {
  check(await sb.from('courses').update(patch).eq('id', id))
}

export async function deleteCourse(sb: SupabaseClient, id: string, opts: { deleteContents: boolean }): Promise<void> {
  if (opts.deleteContents) {
    for (const table of ['tasks', 'notes', 'decks'] as const) {
      check(await sb.from(table).delete().eq('course_id', id))
    }
  }
  // tasks/notes/decks: ON DELETE SET NULL; classes: ON DELETE CASCADE
  check(await sb.from('courses').delete().eq('id', id))
}
```

`lib/data/tasks.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Priority, Task, TaskType } from '../types'
import { check, must } from './util'

export type NewTask = { title: string; course_id?: string | null; type?: TaskType; due_at?: string | null; priority?: Priority }
const COLS = 'id,course_id,title,type,due_at,priority,done_at,created_at'

export async function listOpenTasks(sb: SupabaseClient): Promise<Task[]> {
  return must(await sb.from('tasks').select(COLS).is('done_at', null).order('due_at', { ascending: true, nullsFirst: false }))
}

export async function createTask(sb: SupabaseClient, input: NewTask): Promise<Task> {
  return must(await sb.from('tasks').insert(input).select(COLS).single())
}

export async function setTaskDone(sb: SupabaseClient, id: string, done: boolean): Promise<void> {
  check(await sb.from('tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id))
}

export async function updateTask(sb: SupabaseClient, id: string, patch: Partial<NewTask>): Promise<void> {
  check(await sb.from('tasks').update(patch).eq('id', id))
}

export async function deleteTask(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('tasks').delete().eq('id', id))
}
```

- [ ] **Step 4: Implement `classes.ts`, `notes.ts`**

`lib/data/classes.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClassSlot } from '../types'
import { check, must } from './util'

const COLS = 'id,course_id,day_of_week,start_time,end_time,location,kind'

export async function listClasses(sb: SupabaseClient): Promise<ClassSlot[]> {
  return must(await sb.from('classes').select(COLS).order('day_of_week').order('start_time'))
}

export async function createClass(sb: SupabaseClient, input: Omit<ClassSlot, 'id'>): Promise<ClassSlot> {
  return must(await sb.from('classes').insert(input).select(COLS).single())
}

export async function updateClass(sb: SupabaseClient, id: string, patch: Partial<Omit<ClassSlot, 'id'>>): Promise<void> {
  check(await sb.from('classes').update(patch).eq('id', id))
}

export async function deleteClass(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('classes').delete().eq('id', id))
}
```

`lib/data/notes.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Note, NoteSummary } from '../types'
import { check, must } from './util'

export async function listNotes(sb: SupabaseClient): Promise<NoteSummary[]> {
  return must(await sb.from('notes').select('id,course_id,title,updated_at').order('updated_at', { ascending: false }))
}

export async function getNote(sb: SupabaseClient, id: string): Promise<Note> {
  return must(await sb.from('notes').select('id,course_id,title,content_md,updated_at').eq('id', id).single())
}

export async function createNote(
  sb: SupabaseClient, input: { title?: string; content_md?: string; course_id?: string | null },
): Promise<Note> {
  return must(await sb.from('notes').insert(input).select('id,course_id,title,content_md,updated_at').single())
}

export async function updateNote(
  sb: SupabaseClient, id: string, patch: Partial<Pick<Note, 'title' | 'content_md' | 'course_id'>>,
): Promise<void> {
  check(await sb.from('notes').update(patch).eq('id', id))
}

export async function deleteNote(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('notes').delete().eq('id', id))
}
```

- [ ] **Step 5: Implement `decks.ts`, `cards.ts`, `focus.ts`, `reviews.ts`**

`lib/data/decks.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deck, DeckWithDue } from '../types'
import { check, must } from './util'

export async function listDecksWithDue(sb: SupabaseClient, now: Date): Promise<DeckWithDue[]> {
  const decks: Deck[] = must(await sb.from('decks').select('id,course_id,name').order('created_at'))
  const cards: { deck_id: string; due_at: string }[] = must(await sb.from('cards').select('deck_id,due_at'))
  const nowIso = now.toISOString()
  return decks.map(d => {
    const mine = cards.filter(c => c.deck_id === d.id)
    return { ...d, total: mine.length, due: mine.filter(c => c.due_at <= nowIso).length }
  })
}

export async function createDeck(sb: SupabaseClient, input: { name: string; course_id?: string | null }): Promise<Deck> {
  return must(await sb.from('decks').insert(input).select('id,course_id,name').single())
}

export async function updateDeck(sb: SupabaseClient, id: string, patch: Partial<Omit<Deck, 'id'>>): Promise<void> {
  check(await sb.from('decks').update(patch).eq('id', id))
}

export async function deleteDeck(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('decks').delete().eq('id', id))
}
```

`lib/data/cards.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card } from '../types'
import { cardToState, schedule, stateToCardPatch, type Rating } from '../srs'
import { check, must } from './util'

const COLS = 'id,deck_id,front,back,due_at,interval_days,ease,reps,lapses'

export async function listCards(sb: SupabaseClient, deckId: string): Promise<Card[]> {
  return must(await sb.from('cards').select(COLS).eq('deck_id', deckId).order('created_at'))
}

export async function createCards(sb: SupabaseClient, deckId: string, cards: { front: string; back: string }[]): Promise<Card[]> {
  if (!cards.length) return []
  return must(await sb.from('cards').insert(cards.map(c => ({ ...c, deck_id: deckId }))).select(COLS))
}

export async function updateCard(sb: SupabaseClient, id: string, patch: { front?: string; back?: string }): Promise<void> {
  check(await sb.from('cards').update(patch).eq('id', id))
}

export async function deleteCard(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('cards').delete().eq('id', id))
}

export async function listDueCards(sb: SupabaseClient, now: Date, deckId?: string, limit = 200): Promise<Card[]> {
  let q = sb.from('cards').select(COLS).lte('due_at', now.toISOString()).order('due_at').limit(limit)
  if (deckId) q = q.eq('deck_id', deckId)
  return must(await q)
}

export async function countDueCards(sb: SupabaseClient, now: Date): Promise<number> {
  const { count, error } = await sb.from('cards').select('id', { count: 'exact', head: true }).lte('due_at', now.toISOString())
  if (error) throw error
  return count ?? 0
}

export async function rateCard(sb: SupabaseClient, card: Card, rating: Rating, now: Date): Promise<Card> {
  const next = schedule(cardToState(card), rating, now)
  const updated: Card = must(await sb.from('cards').update(stateToCardPatch(next)).eq('id', card.id).select(COLS).single())
  check(await sb.from('reviews').insert({
    card_id: card.id, rating, reviewed_at: now.toISOString(),
    prev_interval_days: card.interval_days, new_interval_days: next.intervalDays,
  }))
  return updated
}
```

`lib/data/focus.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusSession } from '../types'
import { check, must } from './util'

export async function logFocusSession(
  sb: SupabaseClient, s: { startedAt: Date; endedAt: Date; minutes: number; completed: boolean },
): Promise<void> {
  check(await sb.from('focus_sessions').insert({
    started_at: s.startedAt.toISOString(), ended_at: s.endedAt.toISOString(), minutes: s.minutes, completed: s.completed,
  }))
}

export async function listSessionsSince(sb: SupabaseClient, since: Date): Promise<FocusSession[]> {
  return must(await sb.from('focus_sessions').select('id,started_at,ended_at,minutes,completed')
    .gte('started_at', since.toISOString()).order('started_at'))
}
```

`lib/data/reviews.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Review } from '../types'
import { must } from './util'

export async function listReviewsSince(sb: SupabaseClient, since: Date): Promise<Review[]> {
  return must(await sb.from('reviews').select('id,card_id,rating,reviewed_at').gte('reviewed_at', since.toISOString()).order('reviewed_at'))
}
```

- [ ] **Step 6: Run to verify pass** — `npm run test:db` → all pass (RLS and data).

- [ ] **Step 7: Commit**

```bash
git add lib/data tests/db/data.test.ts
git commit -m "feat: typed data layer with integration tests"
```

---

### Task 11: Courses, Planner tasks tab, and Home

**Files:**
- Create: `components/planner/CourseBar.tsx`, `components/planner/QuickAdd.tsx`, `components/planner/TaskRow.tsx`, `app/(app)/planner/page.tsx`
- Modify: `app/(app)/home/page.tsx` (replace stub)

**Interfaces:**
- Consumes: `listCourses/createCourse/updateCourse/deleteCourse`, `listOpenTasks/createTask/setTaskDone/deleteTask`, `listClasses`, `countDueCards`, `bucketTasks`, `formatDue`, `nextClass`, `parseQuickAdd`, `useProfile`, `useSaver`, `COURSE_COLORS`
- Produces:
  - `<CourseBar courses selected onSelect onChange />` — `onChange(courses: Course[])` after add/edit/delete
  - `<QuickAdd courses defaultCourseId onAdd={(t: NewTask) => void} />` — shows a parsed-date preview before submit
  - `<TaskRow task course tz now onToggle onDelete? />`
  - Planner page state shared later with Task 12: `tab: 'tasks' | 'week' | 'timetable'`

- [ ] **Step 1: `components/planner/TaskRow.tsx`**

```tsx
'use client'
import { Trash2 } from 'lucide-react'
import { CourseDot } from '@/components/ui/CourseDot'
import { formatDue } from '@/lib/dates'
import type { Course, Task } from '@/lib/types'

export function TaskRow({ task, course, tz, now, done, onToggle, onDelete, showType = true }: {
  task: Task; course?: Course; tz: string; now: Date; done?: boolean
  onToggle: () => void; onDelete?: () => void; showType?: boolean
}) {
  return (
    <div className="group flex items-center gap-2.5 border-b border-line py-2">
      <input type="checkbox" checked={!!done} onChange={onToggle} aria-label={`Mark ${task.title} done`} className="size-4 accent-[var(--accent)]" />
      <CourseDot color={course?.color} />
      <span className={`min-w-0 flex-1 truncate ${done ? 'text-muted line-through' : ''}`}>{task.title}</span>
      {showType && task.type !== 'other' && <span className="pill">{task.type}</span>}
      {task.due_at && <span className="text-xs text-muted">{formatDue(task.due_at, tz, now)}</span>}
      {onDelete && (
        <button onClick={onDelete} aria-label={`Delete ${task.title}`} className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `components/planner/QuickAdd.tsx`**

```tsx
'use client'
import { useMemo, useState } from 'react'
import { parseQuickAdd } from '@/lib/quickAdd'
import { formatDue } from '@/lib/dates'
import type { NewTask } from '@/lib/data/tasks'
import type { Course, TaskType } from '@/lib/types'

export function QuickAdd({ courses, defaultCourseId, tz, onAdd, compact = false }: {
  courses: Course[]; defaultCourseId: string | null; tz: string; onAdd: (t: NewTask) => void; compact?: boolean
}) {
  const [text, setText] = useState('')
  const [courseId, setCourseId] = useState<string | null>(defaultCourseId)
  const [type, setType] = useState<TaskType>('other')
  const parsed = useMemo(() => parseQuickAdd(text, tz, new Date()), [text, tz])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.title) return
    onAdd({ title: parsed.title, due_at: parsed.dueAt, course_id: courseId ?? defaultCourseId, type })
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 py-2">
      <input aria-label="Add a task" className="input min-w-0 flex-1" value={text} onChange={e => setText(e.target.value)}
        placeholder="Add a task: Calc problem set fri" />
      {parsed.dueAt && text.trim() && (
        <span className="pill" aria-live="polite">Due {formatDue(parsed.dueAt, tz, new Date())}</span>
      )}
      {!compact && (
        <>
          <select aria-label="Course" className="input" value={courseId ?? defaultCourseId ?? ''} onChange={e => setCourseId(e.target.value || null)}>
            <option value="">No course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Type" className="input" value={type} onChange={e => setType(e.target.value as TaskType)}>
            <option value="other">Task</option><option value="assignment">Assignment</option>
            <option value="exam">Exam</option><option value="reading">Reading</option>
          </select>
        </>
      )}
      <button className="btn" disabled={!text.trim()}>Add</button>
    </form>
  )
}
```

- [ ] **Step 3: `components/planner/CourseBar.tsx`** (chips + add/edit/delete dialogs)

```tsx
'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { CourseDot } from '@/components/ui/CourseDot'
import { COURSE_COLORS } from '@/lib/colors'
import { createCourse, deleteCourse, updateCourse } from '@/lib/data/courses'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/providers/ToastProvider'
import type { Course } from '@/lib/types'

export function CourseBar({ courses, selected, onSelect, onChange }: {
  courses: Course[]; selected: string | null; onSelect: (id: string | null) => void; onChange: (c: Course[]) => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Course | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COURSE_COLORS[0])

  function openNew() { setName(''); setColor(COURSE_COLORS[courses.length % COURSE_COLORS.length]); setEditing('new') }
  function openEdit(c: Course) { setName(c.name); setColor(c.color); setEditing(c) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editing === 'new') {
        const c = await createCourse(supabase(), { name: name.trim(), color })
        onChange([...courses, c])
      } else if (editing) {
        await updateCourse(supabase(), editing.id, { name: name.trim(), color })
        onChange(courses.map(c => (c.id === editing.id ? { ...c, name: name.trim(), color } : c)))
      }
      setEditing(null)
    } catch { toast('Couldn\'t save.') }
  }

  async function remove(deleteContents: boolean) {
    if (!deleting) return
    try {
      await deleteCourse(supabase(), deleting.id, { deleteContents })
      onChange(courses.filter(c => c.id !== deleting.id))
      if (selected === deleting.id) onSelect(null)
      setDeleting(null); setEditing(null)
    } catch { toast('Couldn\'t delete the course.') }
  }

  const chip = (active: boolean) => `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${active ? 'border-accent text-accent' : 'border-line'}`

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button className={chip(selected === null)} onClick={() => onSelect(null)}>All</button>
      {courses.map(c => (
        <button key={c.id} className={chip(selected === c.id)} onClick={() => onSelect(c.id)}
          onDoubleClick={() => openEdit(c)} onContextMenu={e => { e.preventDefault(); openEdit(c) }}
          title="Double-click to edit">
          <CourseDot color={c.color} />{c.name}
        </button>
      ))}
      <button className="btn-ghost" onClick={openNew}><Plus size={14} aria-hidden />Course</button>
      {selected && <button className="btn-ghost" onClick={() => openEdit(courses.find(c => c.id === selected)!)}>Edit</button>}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New course' : 'Edit course'}>
        <form onSubmit={save} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Biology" /></label>
          <div className="flex gap-2" role="radiogroup" aria-label="Color">
            {COURSE_COLORS.map(c => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                className={`size-6 rounded-full ${color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`} style={{ background: c }} />
            ))}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            {editing && editing !== 'new'
              ? <button type="button" className="btn text-danger" onClick={() => setDeleting(editing)}>Delete</button>
              : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary">Save</button>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? 'course'}?`}>
        <p className="mb-4 text-sm text-muted">Its classes will be removed. What should happen to its tasks, decks and notes?</p>
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => remove(false)}>Keep them (no course)</button>
          <button className="btn text-danger" onClick={() => remove(true)}>Delete its tasks, decks and notes</button>
          <button className="btn-ghost justify-center" onClick={() => setDeleting(null)}>Cancel</button>
        </div>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Planner page (Tasks tab; Week/Timetable tabs filled in Task 12)** `app/(app)/planner/page.tsx`

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseBar } from '@/components/planner/CourseBar'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { TaskRow } from '@/components/planner/TaskRow'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createTask, deleteTask, listOpenTasks, setTaskDone, type NewTask } from '@/lib/data/tasks'
import { bucketTasks } from '@/lib/dates'
import type { Course, Task } from '@/lib/types'

type Tab = 'tasks' | 'week' | 'timetable'

export default function PlannerPage() {
  const { profile } = useProfile()
  const save = useSaver()
  const tz = profile.timezone
  const [tab, setTab] = useState<Tab>('tasks')
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listCourses(sb), listOpenTasks(sb)]).then(([c, t]) => { setCourses(c); setTasks(t); setLoaded(true) })
  }, [])

  const now = new Date()
  const visible = useMemo(() => tasks.filter(t => !filter || t.course_id === filter), [tasks, filter])
  const buckets = bucketTasks(visible, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  function add(input: NewTask) {
    const temp: Task = {
      id: `temp-${crypto.randomUUID()}`, course_id: input.course_id ?? null, title: input.title, type: input.type ?? 'other',
      due_at: input.due_at ?? null, priority: 'normal', done_at: null, created_at: new Date().toISOString(),
    }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(t => t.id !== temp.id)),
      async () => { const real = await createTask(supabase(), input); setTasks(ts => ts.map(t => (t.id === temp.id ? real : t))) },
    )
  }

  function toggle(task: Task) {
    save(
      () => setTasks(ts => ts.filter(t => t.id !== task.id)),
      () => setTasks(ts => [...ts, task]),
      () => setTaskDone(supabase(), task.id, true),
    )
  }

  function remove(task: Task) {
    save(
      () => setTasks(ts => ts.filter(t => t.id !== task.id)),
      () => setTasks(ts => [...ts, task]),
      () => deleteTask(supabase(), task.id),
    )
  }

  const group = (label: string, list: Task[], color = 'text-muted') => list.length > 0 && (
    <section className="mt-4">
      <h2 className={`mb-1 text-xs font-medium ${color}`}>{label}</h2>
      {list.map(t => (
        <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} onToggle={() => toggle(t)} onDelete={() => remove(t)} />
      ))}
    </section>
  )

  return (
    <div>
      <PageHeader title="Planner" />
      <CourseBar courses={courses} selected={filter} onSelect={setFilter} onChange={next => {
        setCourses(next)
        listOpenTasks(supabase()).then(setTasks) // course deletion may have changed tasks
      }} />
      <div role="tablist" className="mb-2 flex gap-1">
        {(['tasks', 'week', 'timetable'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 text-sm ${tab === t ? 'bg-surface font-medium' : 'text-muted'}`}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div>
          <QuickAdd courses={courses} defaultCourseId={filter} tz={tz} onAdd={add} />
          {loaded && courses.length === 0 && tasks.length === 0 && (
            <p className="mt-6 text-sm text-muted">Add your first course with “+ Course”, then add tasks above.</p>
          )}
          {group('Overdue', buckets.overdue, 'text-danger')}
          {group('Today', buckets.today, 'text-fg')}
          {group('Upcoming', buckets.upcoming)}
          {group('No date', buckets.noDate)}
        </div>
      )}
      {tab !== 'tasks' && <p className="text-sm text-muted">Coming in the next step.</p>}
    </div>
  )
}
```

- [ ] **Step 5: Home page** — replace `app/(app)/home/page.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Layers, Play, BarChart3, Settings } from 'lucide-react'
import { CourseDot } from '@/components/ui/CourseDot'
import { TaskRow } from '@/components/planner/TaskRow'
import { QuickAdd } from '@/components/planner/QuickAdd'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { createTask, listOpenTasks, setTaskDone, type NewTask } from '@/lib/data/tasks'
import { listClasses } from '@/lib/data/classes'
import { countDueCards } from '@/lib/data/cards'
import { bucketTasks, endOfLocalDay, localDayKey } from '@/lib/dates'
import { nextClass } from '@/lib/timetable'
import type { ClassSlot, Course, Task } from '@/lib/types'

function greeting(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export default function HomePage() {
  const { profile } = useProfile()
  const save = useSaver()
  const tz = profile.timezone
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [classes, setClasses] = useState<ClassSlot[]>([])
  const [due, setDue] = useState(0)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listCourses(sb), listOpenTasks(sb), listClasses(sb), countDueCards(sb, new Date())])
      .then(([c, t, cl, d]) => { setCourses(c); setTasks(t); setClasses(cl); setDue(d) })
  }, [])

  const now = new Date()
  const { overdue, today } = bucketTasks(tasks, tz, now)
  const list = [...overdue, ...today]
  const upcomingClass = nextClass(classes, tz, now)
  const courseOf = (id: string | null) => courses.find(c => c.id === id)
  const hour = Number(formatInTimeZone(now, tz, 'H'))
  const name = profile.display_name ? `, ${profile.display_name}` : ''

  function toggle(t: Task) {
    const wasDone = doneIds.has(t.id)
    const flip = (s: Set<string>) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n }
    save(() => setDoneIds(flip), () => setDoneIds(flip), () => setTaskDone(supabase(), t.id, !wasDone))
  }

  function add(input: NewTask) {
    // Tasks added from Home are due today unless the text names another day
    const withDate = { ...input, due_at: input.due_at ?? endOfLocalDay(localDayKey(now, tz), tz).toISOString() }
    const temp: Task = { id: `temp-${crypto.randomUUID()}`, course_id: null, title: input.title, type: 'other', due_at: withDate.due_at, priority: 'normal', done_at: null, created_at: now.toISOString() }
    save(
      () => setTasks(ts => [...ts, temp]),
      () => setTasks(ts => ts.filter(x => x.id !== temp.id)),
      async () => { const real = await createTask(supabase(), withDate); setTasks(ts => ts.map(x => (x.id === temp.id ? real : x))) },
    )
  }

  const nextCourse = upcomingClass && courseOf(upcomingClass.cls.course_id)
  const nextLabel = upcomingClass && (
    upcomingClass.dayKey === localDayKey(now, tz)
      ? upcomingClass.cls.start_time.slice(0, 5)
      : `${formatInTimeZone(new Date(`${upcomingClass.dayKey}T12:00:00Z`), 'UTC', 'EEE')} ${upcomingClass.cls.start_time.slice(0, 5)}`
  )

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium">{greeting(hour)}{name}</h1>
          <p className="text-muted">{formatInTimeZone(now, tz, 'EEEE, MMM d')}</p>
        </div>
        <div className="flex gap-1 md:hidden">
          <Link href="/progress" aria-label="Progress" className="btn-ghost"><BarChart3 size={16} aria-hidden /></Link>
          <Link href="/settings" aria-label="Settings" className="btn-ghost"><Settings size={16} aria-hidden /></Link>
        </div>
      </div>

      <h2 className="mb-1 text-xs text-muted">Today</h2>
      {list.length === 0 && <p className="py-2 text-sm text-muted">Nothing due today.</p>}
      {list.map(t => (
        <TaskRow key={t.id} task={t} course={courseOf(t.course_id)} tz={tz} now={now} done={doneIds.has(t.id)} onToggle={() => toggle(t)} showType={false} />
      ))}
      <QuickAdd courses={courses} defaultCourseId={null} tz={tz} onAdd={add} compact />

      <div className="mt-6 flex flex-wrap gap-2">
        {upcomingClass && nextCourse && (
          <Link href="/planner" className="btn"><CourseDot color={nextCourse.color} />{nextCourse.name} · {nextLabel}</Link>
        )}
        {due > 0 && <Link href="/review" className="btn"><Layers size={14} aria-hidden />Review {due} cards</Link>}
        <Link href="/focus" className="btn"><Play size={14} aria-hidden />Focus</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify**

Run: `npm test` and `npm run build` → pass. Manual (`npm run dev`): add course "Biology" → chip appears; type "Calc problem set fri" → "Due Fri" preview appears before submitting → task appears under Upcoming (or Today on a Friday); tick it → disappears; stop the local DB (`npx supabase stop`) and tick a task → it reappears with toast "Couldn't save." + Retry; restart DB. Delete course with "Keep them" → its tasks remain with no dot. Home shows today's tasks, adding "Read ch 4" on Home puts it under Today, buttons row shows Focus (and "Review N cards" only when cards are due).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: courses, planner task list, and minimal home"
```

---

### Task 12: Timetable and Week view

**Files:**
- Create: `components/planner/WeekGrid.tsx`, `components/planner/ClassDialog.tsx`
- Modify: `app/(app)/planner/page.tsx`

**Interfaces:**
- Consumes: `listClasses/createClass/updateClass/deleteClass`, `weekKeysFor`, `localDayKey`, `weekdayOfKey`, `useSaver`
- Produces:
  - `<WeekGrid weekKeys todayKey classes courses deadlines onClassClick? onEmptyClick? />` where `deadlines: { id: string; title: string; dayKey: string; color?: string }[]`, `onEmptyClick(dayOfWeek: number, hour: number)`
  - `<ClassDialog open initial courses onClose onSave(input: Omit<ClassSlot,'id'>) onDelete? />`

- [ ] **Step 1: `components/planner/WeekGrid.tsx`**

```tsx
'use client'
import { Flag } from 'lucide-react'
import { weekdayOfKey } from '@/lib/dates'
import type { ClassSlot, Course } from '@/lib/types'

const START_H = 7, END_H = 21, PX_PER_H = 40
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WeekGrid({ weekKeys, todayKey, classes, courses, deadlines, onClassClick, onEmptyClick }: {
  weekKeys: string[]; todayKey: string; classes: ClassSlot[]; courses: Course[]
  deadlines: { id: string; title: string; dayKey: string; color?: string }[]
  onClassClick?: (c: ClassSlot) => void; onEmptyClick?: (dayOfWeek: number, hour: number) => void
}) {
  const height = (END_H - START_H) * PX_PER_H
  const courseOf = (id: string) => courses.find(c => c.id === id)
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] gap-1" style={{ gridTemplateColumns: '40px repeat(7, minmax(0, 1fr))' }}>
        <div />
        {weekKeys.map(k => (
          <div key={k} className={`text-center text-xs font-medium ${k === todayKey ? 'text-accent' : ''}`}>
            {DAY_NAMES[weekdayOfKey(k)]} {Number(k.slice(8))}
          </div>
        ))}
        <div className="relative" style={{ height }}>
          {Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i).filter(h => h % 2 === 0).map(h => (
            <div key={h} className="absolute text-[11px] text-muted" style={{ top: (h - START_H) * PX_PER_H - 6 }}>{h}:00</div>
          ))}
        </div>
        {weekKeys.map(k => {
          const dow = weekdayOfKey(k)
          return (
            <div key={k} className="relative rounded-lg bg-surface" style={{ height }}
              onClick={e => {
                if (!onEmptyClick || e.target !== e.currentTarget) return
                const y = e.nativeEvent.offsetY
                onEmptyClick(dow, Math.min(END_H - 1, START_H + Math.floor(y / PX_PER_H)))
              }}>
              {deadlines.filter(d => d.dayKey === k).map((d, i) => (
                <div key={d.id} className="absolute inset-x-0.5 truncate rounded border border-dashed bg-bg px-1 text-[11px]"
                  style={{ top: 2 + i * 20, borderColor: d.color ?? 'var(--line)' }}>
                  <Flag size={10} className="mr-0.5 inline" aria-hidden />{d.title}
                </div>
              ))}
              {classes.filter(c => c.day_of_week === dow).map(c => {
                const top = ((toMin(c.start_time) - START_H * 60) / 60) * PX_PER_H
                const h = ((toMin(c.end_time) - toMin(c.start_time)) / 60) * PX_PER_H
                const course = courseOf(c.course_id)
                return (
                  <button key={c.id} type="button" onClick={() => onClassClick?.(c)} disabled={!onClassClick}
                    className="absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-white"
                    style={{ top: Math.max(0, top), height: Math.max(18, h - 2), background: course?.color ?? '#888780' }}>
                    {course?.name}<br /><span className="opacity-90">{c.kind}{c.location ? ` · ${c.location}` : ''}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `components/planner/ClassDialog.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import type { ClassKind, ClassSlot, Course } from '@/lib/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ClassDialog({ open, initial, courses, onClose, onSave, onDelete }: {
  open: boolean; initial: Partial<ClassSlot> | null; courses: Course[]
  onClose: () => void; onSave: (input: Omit<ClassSlot, 'id'>) => void; onDelete?: () => void
}) {
  const [courseId, setCourseId] = useState('')
  const [day, setDay] = useState(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [location, setLocation] = useState('')
  const [kind, setKind] = useState<ClassKind>('lecture')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCourseId(initial?.course_id ?? courses[0]?.id ?? '')
    setDay(initial?.day_of_week ?? 1)
    setStart(initial?.start_time?.slice(0, 5) ?? '09:00')
    setEnd(initial?.end_time?.slice(0, 5) ?? '10:00')
    setLocation(initial?.location ?? '')
    setKind(initial?.kind ?? 'lecture')
    setError(null)
  }, [open, initial, courses])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseId) { setError('Add a course first.'); return }
    if (end <= start) { setError('End time must be after start time.'); return }
    onSave({ course_id: courseId, day_of_week: day, start_time: start, end_time: end, location: location.trim() || null, kind })
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial?.id ? 'Edit class' : 'Add class'}>
      <form onSubmit={submit} className="space-y-3">
        <label className="field"><span>Course</span>
          <select value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="field"><span>Day</span>
            <select value={day} onChange={e => setDay(Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label className="field"><span>Type</span>
            <select value={kind} onChange={e => setKind(e.target.value as ClassKind)}>
              {['lecture', 'lab', 'tutorial', 'seminar', 'other'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="field"><span>Start</span><input type="time" value={start} onChange={e => { setStart(e.target.value); setError(null) }} /></label>
          <label className="field"><span>End</span><input type="time" value={end} onChange={e => { setEnd(e.target.value); setError(null) }} /></label>
        </div>
        <label className="field"><span>Location</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room B12" /></label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">Repeats every week.</p>
        <div className="flex justify-between pt-1">
          {onDelete ? <button type="button" className="btn text-danger" onClick={onDelete}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 3: Wire Week and Timetable tabs into `app/(app)/planner/page.tsx`**

Add imports:
```tsx
import { WeekGrid } from '@/components/planner/WeekGrid'
import { ClassDialog } from '@/components/planner/ClassDialog'
import { createClass, deleteClass, listClasses, updateClass } from '@/lib/data/classes'
import { localDayKey, weekKeysFor } from '@/lib/dates'
import type { ClassSlot } from '@/lib/types'
```

Add state and loading (extend the existing `useEffect`'s `Promise.all` with `listClasses(sb)` and `setClasses`):
```tsx
const [classes, setClasses] = useState<ClassSlot[]>([])
const [dialog, setDialog] = useState<Partial<ClassSlot> | null>(null)
```

Add handlers:
```tsx
const todayKey = localDayKey(now, tz)
const weekKeys = weekKeysFor(todayKey)
const visibleClasses = classes.filter(c => !filter || c.course_id === filter)
const deadlines = visible
  .filter(t => t.due_at && weekKeys.includes(localDayKey(t.due_at, tz)))
  .map(t => ({ id: t.id, title: t.title, dayKey: localDayKey(t.due_at!, tz), color: courseOf(t.course_id)?.color }))

function saveClass(input: Omit<ClassSlot, 'id'>) {
  const editing = dialog?.id
  setDialog(null)
  if (editing) {
    const before = classes.find(c => c.id === editing)!
    save(
      () => setClasses(cs => cs.map(c => (c.id === editing ? { ...c, ...input } : c))),
      () => setClasses(cs => cs.map(c => (c.id === editing ? before : c))),
      () => updateClass(supabase(), editing, input),
    )
  } else {
    const temp = { ...input, id: `temp-${crypto.randomUUID()}` }
    save(
      () => setClasses(cs => [...cs, temp]),
      () => setClasses(cs => cs.filter(c => c.id !== temp.id)),
      async () => { const real = await createClass(supabase(), input); setClasses(cs => cs.map(c => (c.id === temp.id ? real : c))) },
    )
  }
}

function removeClass(id: string) {
  const before = classes.find(c => c.id === id)!
  setDialog(null)
  save(
    () => setClasses(cs => cs.filter(c => c.id !== id)),
    () => setClasses(cs => [...cs, before]),
    () => deleteClass(supabase(), id),
  )
}
```

Also refresh classes after course changes (in `CourseBar onChange`): `listClasses(supabase()).then(setClasses)`.

Replace `{tab !== 'tasks' && <p …>Coming in the next step.</p>}` with:
```tsx
{tab === 'week' && (
  <WeekGrid weekKeys={weekKeys} todayKey={todayKey} classes={visibleClasses} courses={courses} deadlines={deadlines} />
)}
{tab === 'timetable' && (
  <div>
    {courses.length === 0
      ? <p className="text-sm text-muted">Add a course first, then add its classes here.</p>
      : <button className="btn mb-3" onClick={() => setDialog({})}>Add class</button>}
    <WeekGrid weekKeys={weekKeys} todayKey={todayKey} classes={visibleClasses} courses={courses} deadlines={[]}
      onClassClick={c => setDialog(c)}
      onEmptyClick={(dow, h) => courses.length && setDialog({ day_of_week: dow, start_time: `${String(h).padStart(2, '0')}:00`, end_time: `${String(h + 1).padStart(2, '0')}:00` })} />
    <ClassDialog open={dialog !== null} initial={dialog} courses={courses} onClose={() => setDialog(null)}
      onSave={saveClass} onDelete={dialog?.id ? () => removeClass(dialog.id!) : undefined} />
  </div>
)}
```

- [ ] **Step 4: Verify**

`npm run build` → passes. Manual: Timetable → Add class Biology Mon 10:00–11:30 lecture B12 → block appears on Monday; click empty Wednesday 14:00 → dialog prefilled 14:00–15:00; end before start → "End time must be after start time."; Week tab shows the classes plus a dashed flag for a task due this week; Home shows "Biology · 10:00" when it is the next class.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: weekly timetable and week view"
```

---

### Task 13: Flashcards — decks, card editor, and review

**Files:**
- Create: `components/flashcards/CardFace.tsx`, `components/notes/MarkdownView.tsx`, `app/(app)/flashcards/page.tsx`, `app/(app)/flashcards/[deck]/page.tsx`, `app/(app)/review/page.tsx`, `lib/ui/reviewKeys.ts`
- Test: `tests/unit/reviewKeys.test.ts`

**Interfaces:**
- Consumes: `listDecksWithDue/createDeck/updateDeck/deleteDeck`, `listCards/createCards/updateCard/deleteCard/listDueCards/rateCard`, `previewIntervals`, `cardToState`, `Rating`, `listCourses`
- Produces:
  - `<MarkdownView source: string className? />` (GFM + KaTeX; reused by notes in Task 15)
  - `<CardFace text />`
  - `reviewKeyAction(e: { key: string; repeat: boolean }, revealed: boolean, busy: boolean): { type: 'reveal' } | { type: 'rate'; rating: Rating } | null`

- [ ] **Step 1: Write the failing test for key handling** `tests/unit/reviewKeys.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { reviewKeyAction } from '@/lib/ui/reviewKeys'

describe('reviewKeyAction', () => {
  it('space reveals when hidden', () => {
    expect(reviewKeyAction({ key: ' ', repeat: false }, false, false)).toEqual({ type: 'reveal' })
  })
  it('1-4 rate only after reveal', () => {
    expect(reviewKeyAction({ key: '3', repeat: false }, false, false)).toBeNull()
    expect(reviewKeyAction({ key: '3', repeat: false }, true, false)).toEqual({ type: 'rate', rating: 3 })
  })
  it('ignores held keys (auto-repeat) so one press rates one card', () => {
    expect(reviewKeyAction({ key: '3', repeat: true }, true, false)).toBeNull()
    expect(reviewKeyAction({ key: ' ', repeat: true }, false, false)).toBeNull()
  })
  it('ignores input while a rating is saving', () => {
    expect(reviewKeyAction({ key: '4', repeat: false }, true, true)).toBeNull()
  })
  it('space after reveal does nothing', () => {
    expect(reviewKeyAction({ key: ' ', repeat: false }, true, false)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- reviewKeys` → FAIL.

- [ ] **Step 3: Implement `lib/ui/reviewKeys.ts`**

```ts
import type { Rating } from '../srs'

export function reviewKeyAction(
  e: { key: string; repeat: boolean }, revealed: boolean, busy: boolean,
): { type: 'reveal' } | { type: 'rate'; rating: Rating } | null {
  if (e.repeat || busy) return null
  if (!revealed) return e.key === ' ' || e.key === 'Enter' ? { type: 'reveal' } : null
  if (['1', '2', '3', '4'].includes(e.key)) return { type: 'rate', rating: Number(e.key) as Rating }
  return null
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- reviewKeys` → pass.

- [ ] **Step 5: `components/notes/MarkdownView.tsx` and `components/flashcards/CardFace.tsx`**

```tsx
// components/notes/MarkdownView.tsx
'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export function MarkdownView({ source, className = '' }: { source: string; className?: string }) {
  return (
    <div className={`prose-note ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{source}</ReactMarkdown>
    </div>
  )
}
```

```tsx
// components/flashcards/CardFace.tsx
import { MarkdownView } from '@/components/notes/MarkdownView'

export function CardFace({ text }: { text: string }) {
  return <MarkdownView source={text} className="text-base" />
}
```

Append to `app/globals.css` (used by notes and cards):
```css
.prose-note h1 { font-size: 1.25rem; font-weight: 500; margin: .6em 0 .3em; }
.prose-note h2 { font-size: 1.1rem; font-weight: 500; margin: .6em 0 .3em; }
.prose-note h3 { font-weight: 500; margin: .5em 0 .2em; }
.prose-note p { margin: .4em 0; line-height: 1.65; }
.prose-note ul { list-style: disc; padding-left: 1.4em; }
.prose-note ol { list-style: decimal; padding-left: 1.4em; }
.prose-note code { font-family: ui-monospace, monospace; background: var(--surface); padding: 0 .25em; border-radius: 4px; }
.prose-note pre { background: var(--surface); padding: .75em; border-radius: 8px; overflow-x: auto; }
.prose-note input[type=checkbox] { margin-right: .4em; }
```

- [ ] **Step 6: Deck list** `app/(app)/flashcards/page.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dialog } from '@/components/ui/Dialog'
import { CourseDot } from '@/components/ui/CourseDot'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import { listCourses } from '@/lib/data/courses'
import type { Course, DeckWithDue } from '@/lib/types'

export default function FlashcardsPage() {
  const toast = useToast()
  const [decks, setDecks] = useState<DeckWithDue[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState('')

  useEffect(() => {
    const sb = supabase()
    Promise.all([listDecksWithDue(sb, new Date()), listCourses(sb)]).then(([d, c]) => { setDecks(d); setCourses(c) })
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const d = await createDeck(supabase(), { name: name.trim(), course_id: courseId || null })
      setDecks(ds => [...(ds ?? []), { ...d, due: 0, total: 0 }])
      setOpen(false); setName(''); setCourseId('')
    } catch { toast('Couldn\'t save.') }
  }

  const totalDue = decks?.reduce((n, d) => n + d.due, 0) ?? 0
  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Flashcards" actions={<>
        {totalDue > 0 && <Link href="/review" className="btn-primary">Review all ({totalDue})</Link>}
        <button className="btn" onClick={() => setOpen(true)}><Plus size={14} aria-hidden />Deck</button>
      </>} />
      {decks?.length === 0 && (
        <div className="card text-center">
          <p className="mb-3 text-sm text-muted">Group cards into decks, one per topic.</p>
          <button className="btn-primary" onClick={() => setOpen(true)}>Create a deck</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decks?.map(d => (
          <Link key={d.id} href={`/flashcards/${d.id}`} className="card hover:border-accent">
            <div className="flex items-center gap-2 font-medium"><CourseDot color={courseOf(d.course_id)?.color} />{d.name}</div>
            <div className="mt-1 text-sm text-muted">{d.due > 0 ? `${d.due} due` : 'All caught up'} · {d.total} cards</div>
          </Link>
        ))}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="New deck">
        <form onSubmit={create} className="space-y-3">
          <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Cell biology" /></label>
          <label className="field"><span>Course</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
        </form>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 7: Deck / card editor** `app/(app)/flashcards/[deck]/page.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardFace } from '@/components/flashcards/CardFace'
import { useSaver, useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createCards, deleteCard, listCards, updateCard } from '@/lib/data/cards'
import { deleteDeck, listDecksWithDue } from '@/lib/data/decks'
import type { Card, DeckWithDue } from '@/lib/types'

export default function DeckPage() {
  const { deck: deckId } = useParams<{ deck: string }>()
  const router = useRouter()
  const save = useSaver()
  const toast = useToast()
  const [deck, setDeck] = useState<DeckWithDue | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    const sb = supabase()
    Promise.all([listDecksWithDue(sb, new Date()), listCards(sb, deckId)]).then(([ds, cs]) => {
      setDeck(ds.find(d => d.id === deckId) ?? null); setCards(cs)
    })
  }, [deckId])

  async function add(e?: React.FormEvent) {
    e?.preventDefault()
    if (!front.trim() || !back.trim()) return
    try {
      const [c] = await createCards(supabase(), deckId, [{ front: front.trim(), back: back.trim() }])
      setCards(cs => [...cs, c]); setFront(''); setBack('')
      document.getElementById('front')?.focus()
    } catch { toast('Couldn\'t save.') }
  }

  function saveEdit(card: Card, patch: { front: string; back: string }) {
    setEditing(null)
    save(
      () => setCards(cs => cs.map(c => (c.id === card.id ? { ...c, ...patch } : c))),
      () => setCards(cs => cs.map(c => (c.id === card.id ? card : c))),
      () => updateCard(supabase(), card.id, patch),
    )
  }

  function remove(card: Card) {
    save(
      () => setCards(cs => cs.filter(c => c.id !== card.id)),
      () => setCards(cs => [...cs, card]),
      () => deleteCard(supabase(), card.id),
    )
  }

  async function removeDeck() {
    if (!confirm(`Delete “${deck?.name}” and its ${cards.length} cards?`)) return
    try { await deleteDeck(supabase(), deckId); router.replace('/flashcards') } catch { toast('Couldn\'t delete the deck.') }
  }

  const due = cards.filter(c => c.due_at <= new Date().toISOString()).length

  return (
    <div>
      <PageHeader title={deck?.name ?? 'Deck'} actions={<>
        {due > 0 && <Link href={`/review?deck=${deckId}`} className="btn-primary">Review {due}</Link>}
        <button className="btn-ghost text-danger" onClick={removeDeck}>Delete deck</button>
      </>} />
      <form onSubmit={add} className="card mb-4 grid gap-2 sm:grid-cols-2"
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add() }}>
        <label className="field"><span>Front</span><textarea id="front" rows={2} value={front} onChange={e => setFront(e.target.value)} placeholder="What is the main function of mitochondria?" /></label>
        <label className="field"><span>Back</span><textarea rows={2} value={back} onChange={e => setBack(e.target.value)} placeholder="Produce ATP through cellular respiration" /></label>
        <div className="flex items-center justify-between sm:col-span-2">
          <span className="text-xs text-muted">Math works: $x^2$ · Ctrl+Enter to add</span>
          <button className="btn" disabled={!front.trim() || !back.trim()}>Add card</button>
        </div>
      </form>
      {cards.length === 0 && <p className="text-sm text-muted">Add your first card above.</p>}
      <div className="divide-y divide-line">
        {cards.map(c => editing === c.id ? (
          <EditRow key={c.id} card={c} onSave={p => saveEdit(c, p)} onCancel={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="group grid grid-cols-[1fr_1fr_auto] gap-3 py-2 text-sm">
            <button className="text-left" onClick={() => setEditing(c.id)}><CardFace text={c.front} /></button>
            <button className="text-left text-muted" onClick={() => setEditing(c.id)}><CardFace text={c.back} /></button>
            <button aria-label="Delete card" className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(c)}><Trash2 size={14} aria-hidden /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditRow({ card, onSave, onCancel }: { card: Card; onSave: (p: { front: string; back: string }) => void; onCancel: () => void }) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  return (
    <div className="grid gap-2 py-2 sm:grid-cols-2">
      <textarea className="input" rows={2} value={front} onChange={e => setFront(e.target.value)} aria-label="Front" />
      <textarea className="input" rows={2} value={back} onChange={e => setBack(e.target.value)} aria-label="Back" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!front.trim() || !back.trim()} onClick={() => onSave({ front: front.trim(), back: back.trim() })}>Save</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Review session** `app/(app)/review/page.tsx`

```tsx
'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CardFace } from '@/components/flashcards/CardFace'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listDueCards, rateCard } from '@/lib/data/cards'
import { cardToState, previewIntervals, type Rating } from '@/lib/srs'
import { reviewKeyAction } from '@/lib/ui/reviewKeys'
import type { Card } from '@/lib/types'

const LABELS: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
const COLORS: Record<Rating, string> = { 1: 'text-danger', 2: 'text-amber-600', 3: 'text-accent', 4: 'text-green-600' }

function Review() {
  const deckId = useSearchParams().get('deck') ?? undefined
  const toast = useToast()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [initialCount, setInitialCount] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState({ reviewed: 0, again: 0 })
  const busy = useRef(false)

  useEffect(() => {
    listDueCards(supabase(), new Date(), deckId).then(cs => { setQueue(cs); setInitialCount(cs.length) })
  }, [deckId])

  const card = queue?.[0]

  const rate = useCallback(async (rating: Rating) => {
    if (!card || busy.current) return
    busy.current = true
    try {
      const updated = await rateCard(supabase(), card, rating, new Date())
      setStats(s => ({ reviewed: s.reviewed + 1, again: s.again + (rating === 1 ? 1 : 0) }))
      // "Again" cards come back at the end of this session
      setQueue(q => (q ? [...q.slice(1), ...(rating === 1 ? [updated] : [])] : q))
      setRevealed(false)
    } catch {
      toast('Couldn\'t save.', { label: 'Retry', onClick: () => void rate(rating) })
    } finally {
      busy.current = false
    }
  }, [card, toast])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      const action = reviewKeyAction(e, revealed, busy.current)
      if (!action) return
      e.preventDefault()
      if (action.type === 'reveal') setRevealed(true)
      else void rate(action.rating)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, rate])

  if (!queue) return null

  if (!card) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 text-lg font-medium">{stats.reviewed ? 'Session complete' : 'Nothing due right now'}</h1>
        {stats.reviewed > 0 && <p className="mb-4 text-muted">{stats.reviewed} reviews · {stats.again} marked Again</p>}
        <Link href="/flashcards" className="btn">Back to decks</Link>
      </div>
    )
  }

  const preview = previewIntervals(cardToState(card), new Date())
  const done = Math.min(initialCount, stats.reviewed)

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-1 flex justify-between text-sm text-muted"><span>Review</span><span>{done} / {initialCount}</span></div>
      <div className="mb-6 h-1 rounded bg-surface"><div className="h-1 rounded bg-accent" style={{ width: `${initialCount ? (done / initialCount) * 100 : 0}%` }} /></div>
      <div className="card flex min-h-52 flex-col items-center justify-center gap-4 text-center">
        <CardFace text={card.front} />
        {revealed && <div className="w-full border-t border-line pt-4 text-accent"><CardFace text={card.back} /></div>}
      </div>
      <div className="mt-5 flex justify-center gap-2">
        {!revealed ? (
          <button className="btn min-w-48" onClick={() => setRevealed(true)}>Show answer <span className="text-muted">· space</span></button>
        ) : ([1, 2, 3, 4] as Rating[]).map(r => (
          <button key={r} className="btn min-w-20 flex-col gap-0" onClick={() => void rate(r)}>
            <span className={COLORS[r]}>{LABELS[r]}</span>
            <span className="text-[11px] text-muted">{preview[r]} · {r}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return <Suspense><Review /></Suspense>
}
```

- [ ] **Step 9: Verify**

`npm test`, `npm run build` → pass. Manual: create deck → add 3 cards (one with `$x^2$`, rendered as math) → Review → space reveals → hold "3" down → only one card is rated (the counter goes up by one) → rate "1" on a card → it reappears at the end → finish → "Session complete" summary. Home shows "Review N cards" only while cards are due.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: flashcard decks, card editor, and spaced-repetition review"
```

---

### Task 14: Focus timer and ambient sounds

**Files:**
- Create: `app/(app)/focus/page.tsx`, `lib/ui/timerStore.ts`, `public/sounds/README.md`
- Test: `tests/unit/timerStore.test.ts`

**Interfaces:**
- Consumes: `lib/timer.ts` (all exports), `logFocusSession`, `listSessionsSince`, `dailyMinutes`, `localDayKey`, `startOfLocalDay`, `useProfile`, `useToast`
- Produces:
  - `loadTimer(storage: Pick<Storage,'getItem'>): PersistedTimer | null`, `saveTimer(storage: Pick<Storage,'setItem'>, t: PersistedTimer): void` where `PersistedTimer = { state: TimerState; completedFocus: number; dayKey: string }`
  - Sound files expected at `/sounds/rain.mp3`, `/sounds/cafe.mp3`, `/sounds/lofi.mp3`

- [ ] **Step 1: Write the failing test** `tests/unit/timerStore.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { loadTimer, saveTimer } from '@/lib/ui/timerStore'
import { createTimer } from '@/lib/timer'

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('timerStore', () => {
  it('round-trips state so a reload keeps the running timer', () => {
    const s = memory()
    const t = { state: { ...createTimer('focus', 1500_000), startedAt: 123, firstStartedAt: 123 }, completedFocus: 2, dayKey: '2026-10-01' }
    saveTimer(s, t)
    expect(loadTimer(s)).toEqual(t)
  })
  it('returns null for missing or corrupt data', () => {
    const s = memory()
    expect(loadTimer(s)).toBeNull()
    s.setItem('studyhub.timer', '{not json')
    expect(loadTimer(s)).toBeNull()
    s.setItem('studyhub.timer', JSON.stringify({ state: { mode: 'nap' } }))
    expect(loadTimer(s)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- timerStore` → FAIL.

- [ ] **Step 3: Implement `lib/ui/timerStore.ts`**

```ts
import type { TimerState } from '../timer'

export interface PersistedTimer { state: TimerState; completedFocus: number; dayKey: string }
const KEY = 'studyhub.timer'

export function loadTimer(storage: Pick<Storage, 'getItem'>): PersistedTimer | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as PersistedTimer
    const s = v?.state
    if (!s || !['focus', 'short', 'long'].includes(s.mode) || typeof s.durationMs !== 'number'
      || typeof v.completedFocus !== 'number' || typeof v.dayKey !== 'string') return null
    return v
  } catch {
    return null
  }
}

export function saveTimer(storage: Pick<Storage, 'setItem'>, t: PersistedTimer): void {
  try { storage.setItem(KEY, JSON.stringify(t)) } catch { /* storage unavailable: timer still works for this page view */ }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- timerStore` → pass.

- [ ] **Step 5: Focus page** `app/(app)/focus/page.tsx`

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Headphones } from 'lucide-react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince, logFocusSession } from '@/lib/data/focus'
import { dailyMinutes } from '@/lib/streak'
import { localDayKey, startOfLocalDay } from '@/lib/dates'
import {
  createTimer, durationFor, elapsedMs, isFinished, markLogged, nextMode, pauseTimer, remainingMs,
  shouldLogSession, startTimer, type Mode, type TimerState,
} from '@/lib/timer'
import { loadTimer, saveTimer } from '@/lib/ui/timerStore'

const MODE_LABEL: Record<Mode, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
const SOUNDS = [{ id: 'off', label: 'Off' }, { id: 'rain', label: 'Rain' }, { id: 'cafe', label: 'Café' }, { id: 'lofi', label: 'Lo-fi' }]
const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

export default function FocusPage() {
  const { profile } = useProfile()
  const toast = useToast()
  const tz = profile.timezone
  const [timer, setTimer] = useState<TimerState>(() => createTimer('focus', durationFor('focus', profile)))
  const [completedFocus, setCompletedFocus] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [sound, setSound] = useState('off')
  const [volume, setVolume] = useState(0.6)
  const [soundError, setSoundError] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const hydrated = useRef(false)

  // Restore a running timer after reload; reset the cycle count on a new day
  useEffect(() => {
    const saved = loadTimer(window.localStorage)
    const today = localDayKey(new Date(), tz)
    if (saved) { setTimer(saved.state); setCompletedFocus(saved.dayKey === today ? saved.completedFocus : 0) }
    hydrated.current = true
    listSessionsSince(supabase(), startOfLocalDay(today, tz))
      .then(s => setTodayMinutes(dailyMinutes(s, tz).get(today) ?? 0))
  }, [tz])

  useEffect(() => {
    if (hydrated.current) saveTimer(window.localStorage, { state: timer, completedFocus, dayKey: localDayKey(new Date(), tz) })
  }, [timer, completedFocus, tz])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const log = useCallback(async (t: TimerState, at: number, completed: boolean) => {
    const minutes = Math.round(elapsedMs(t, at) / 60_000)
    try {
      await logFocusSession(supabase(), { startedAt: new Date(t.firstStartedAt ?? at), endedAt: new Date(at), minutes, completed })
      setTodayMinutes(m => m + minutes)
    } catch {
      toast('Couldn\'t save this session.', { label: 'Retry', onClick: () => void log(t, at, completed) })
    }
  }, [toast])

  const advance = useCallback((from: TimerState, count: number) => {
    const mode = nextMode(from.mode, count, profile.long_break_every)
    setTimer(createTimer(mode, durationFor(mode, profile)))
  }, [profile])

  // Finish: log once (markLogged makes a second pass a no-op), then move to the next mode
  useEffect(() => {
    if (timer.startedAt === null || !isFinished(timer, now)) return
    const finishedAt = timer.startedAt + (timer.durationMs - timer.accumulatedMs)
    let count = completedFocus
    if (timer.mode === 'focus') {
      count += 1
      setCompletedFocus(count)
      if (shouldLogSession(timer, now)) void log(markLogged(timer), finishedAt, true)
    }
    advance(timer, count)
  }, [now, timer, completedFocus, log, advance])

  function toggle() {
    const t = Date.now()
    setTimer(s => (s.startedAt === null ? startTimer(s, t) : pauseTimer(s, t)))
  }

  function skip() {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    advance(timer, completedFocus) // a skipped focus session doesn't count toward the long break
  }

  function pickMode(mode: Mode) {
    const t = Date.now()
    if (shouldLogSession(timer, t)) void log(markLogged(timer), t, false)
    setTimer(createTimer(mode, durationFor(mode, profile)))
  }

  useEffect(() => {
    const a = audio.current
    if (!a) return
    a.volume = volume
    if (sound === 'off') { a.pause(); return }
    setSoundError(false)
    a.src = `/sounds/${sound}.mp3`
    a.play().catch(() => setSoundError(true))
  }, [sound, volume])

  const remaining = remainingMs(timer, now)
  const pct = 1 - remaining / timer.durationMs
  const R = 88, C = 2 * Math.PI * R
  const running = timer.startedAt !== null
  const goal = profile.daily_goal_minutes
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

  useEffect(() => { document.title = running ? `${fmt(remaining)} · ${MODE_LABEL[timer.mode]}` : 'Studyhub' }, [running, remaining, timer.mode])

  return (
    <div className="mx-auto max-w-md text-center">
      <div role="tablist" className="flex justify-center gap-1">
        {(['focus', 'short', 'long'] as Mode[]).map(m => (
          <button key={m} role="tab" aria-selected={timer.mode === m} onClick={() => pickMode(m)}
            className={`rounded-lg px-3 py-1 text-sm ${timer.mode === m ? 'bg-surface font-medium' : 'text-muted'}`}>{MODE_LABEL[m]}</button>
        ))}
      </div>
      <div className="relative mx-auto my-6 size-56">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface)" strokeWidth="8" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-4xl font-medium" aria-live="off">{fmt(remaining)}</div>
          {timer.mode === 'focus' && <div className="text-sm text-muted">Session {(completedFocus % profile.long_break_every) + 1} of {profile.long_break_every}</div>}
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <button className="btn-primary min-w-28" onClick={toggle}>
          {running ? <><Pause size={14} aria-hidden />Pause</> : <><Play size={14} aria-hidden />{timer.accumulatedMs ? 'Resume' : 'Start'}</>}
        </button>
        <button className="btn" onClick={skip}><SkipForward size={14} aria-hidden />Skip</button>
      </div>

      <div className="card mx-auto mt-6 flex flex-wrap items-center gap-2 text-sm">
        <Headphones size={16} aria-hidden className="text-muted" />
        {SOUNDS.map(s => (
          <button key={s.id} onClick={() => setSound(s.id)} aria-pressed={sound === s.id}
            className={`rounded-lg px-2.5 py-1 ${sound === s.id ? 'bg-surface font-medium' : 'text-muted'}`}>{s.label}</button>
        ))}
        <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(Number(e.target.value))} className="min-w-20 flex-1" />
        {soundError && <p className="w-full text-left text-xs text-danger">This sound isn't available.</p>}
      </div>
      <audio ref={audio} loop preload="none" />
      <p className="mt-4 text-sm text-muted">Today {fmtMin(todayMinutes)} of {fmtMin(goal)} goal</p>
    </div>
  )
}
```

- [ ] **Step 6: Sound files (user-supplied)**

Create `public/sounds/README.md`:
```md
Place three looping audio files here: rain.mp3, cafe.mp3, lofi.mp3.
Use files you have the rights to ship (e.g. CC0 / public-domain loops). Keep each under ~2 MB.
If a file is missing, the Focus page shows "This sound isn't available." and the timer still works.
```

Tell the user to download three CC0 loops (for example from Pixabay or Freesound, filtered to CC0) and save them with those names. Do not download them on the user's behalf without asking.

- [ ] **Step 7: Verify**

`npm test`, `npm run build` → pass. Manual: Settings focus length not yet editable — temporarily set `focus_minutes = 1` for your user in Supabase Studio (`http://127.0.0.1:54323`). Start → switch tabs for 70s → return → timer has moved to "Short break", one `focus_sessions` row exists (check Studio). Reload mid-session → timer continues. Start a 25-min focus, Skip at 2 min → no row logged; at ≥5 min → one row with `completed = false`. Pick Rain without the file → "This sound isn't available." Reset `focus_minutes` to 25.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: pomodoro focus timer with ambient sounds and session logging"
```

---

### Task 15: Notes — list, autosave, and Rich/Markdown editor with math

**Files:**
- Create: `lib/ui/autosave.ts`, `lib/ui/useAutosave.ts`, `components/notes/RichEditor.tsx`, `app/(app)/notes/page.tsx`, `app/(app)/notes/[id]/page.tsx`
- Test: `tests/unit/autosave.test.ts`, `tests/unit/markdownRoundTrip.test.ts`

**Interfaces:**
- Consumes: `listNotes/getNote/createNote/updateNote/deleteNote`, `listCourses`, `MarkdownView`, `useProfile`, `useOnline`
- Produces:
  - `type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'`
  - `createAutosaver<T>(save: (v: T) => Promise<void>, onStatus: (s: SaveStatus) => void, delayMs = 1000): { update(v: T): void; flush(): Promise<void>; hasPending(): boolean }`
  - `useAutosave<T>(save: (v: T) => Promise<void>, delayMs?): { update: (v: T) => void; status: SaveStatus; flush: () => Promise<void> }`
  - `noteExtensions(): Extension[]` and `<RichEditor markdown onChange(md: string) />` in `components/notes/RichEditor.tsx`

- [ ] **Step 1: Write the failing autosave test** `tests/unit/autosave.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAutosaver, type SaveStatus } from '@/lib/ui/autosave'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function deferred() {
  let resolve!: () => void, reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createAutosaver', () => {
  it('debounces: only the last value within the delay is saved', async () => {
    const saved: string[] = []
    const a = createAutosaver<string>(async v => { saved.push(v) }, () => {}, 1000)
    a.update('a'); a.update('ab'); a.update('abc')
    await vi.advanceTimersByTimeAsync(999)
    expect(saved).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(saved).toEqual(['abc'])
  })

  it('saves the newest text when edits happen during a slow save', async () => {
    const saved: string[] = []
    const first = deferred()
    let call = 0
    const a = createAutosaver<string>(async v => { call++; if (call === 1) await first.promise; saved.push(v) }, () => {}, 1000)
    a.update('one')
    await vi.advanceTimersByTimeAsync(1000) // save of "one" in flight
    a.update('two')
    await vi.advanceTimersByTimeAsync(1000) // timer fires while still in flight
    first.resolve()
    await vi.runAllTimersAsync()
    expect(saved).toEqual(['one', 'two'])
  })

  it('flush saves immediately (used when leaving the page)', async () => {
    const saved: string[] = []
    const a = createAutosaver<string>(async v => { saved.push(v) }, () => {}, 1000)
    a.update('x')
    await a.flush()
    expect(saved).toEqual(['x'])
    expect(a.hasPending()).toBe(false)
  })

  it('keeps the value after a failed save and reports error; flush retries it', async () => {
    const statuses: SaveStatus[] = []
    let fail = true
    const saved: string[] = []
    const a = createAutosaver<string>(async v => { if (fail) throw new Error('net'); saved.push(v) }, s => statuses.push(s), 1000)
    a.update('keep me')
    await vi.advanceTimersByTimeAsync(1000)
    expect(statuses.at(-1)).toBe('error')
    expect(a.hasPending()).toBe(true)
    fail = false
    await a.flush()
    expect(saved).toEqual(['keep me'])
    expect(statuses.at(-1)).toBe('saved')
  })

  it('a newer edit made during a failing save is not overwritten by the old value', async () => {
    const saved: string[] = []
    const first = deferred()
    let call = 0
    const a = createAutosaver<string>(async v => { call++; if (call === 1) { await first.promise; throw new Error('x') } saved.push(v) }, () => {}, 1000)
    a.update('old')
    await vi.advanceTimersByTimeAsync(1000)
    a.update('new')
    first.reject(new Error('x'))
    await vi.advanceTimersByTimeAsync(0)
    await a.flush()
    expect(saved).toEqual(['new'])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- autosave` → FAIL.

- [ ] **Step 3: Implement `lib/ui/autosave.ts`**

```ts
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export function createAutosaver<T>(
  save: (v: T) => Promise<void>, onStatus: (s: SaveStatus) => void, delayMs = 1000,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { v: T } | null = null
  let inFlight: Promise<void> | null = null

  async function drain(): Promise<void> {
    while (pending) {
      const item = pending
      pending = null
      onStatus('saving')
      try {
        await save(item.v)
      } catch {
        pending = pending ?? item // a newer edit wins over the failed older one
        onStatus('error')
        return
      }
    }
    onStatus('saved')
  }

  function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null }
    if (!inFlight) inFlight = drain().finally(() => { inFlight = null })
    return inFlight
  }

  return {
    update(v: T) {
      pending = { v }
      onStatus('pending')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void flush() }, delayMs)
    },
    flush,
    hasPending: () => pending !== null,
  }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- autosave` → all pass.

- [ ] **Step 5: Implement the React hook** `lib/ui/useAutosave.ts`

```ts
'use client'
import { useEffect, useRef, useState } from 'react'
import { createAutosaver, type SaveStatus } from './autosave'

export function useAutosave<T>(save: (v: T) => Promise<void>, delayMs = 1000) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const saveRef = useRef(save)
  saveRef.current = save
  const saver = useRef<ReturnType<typeof createAutosaver<T>> | null>(null)
  saver.current ??= createAutosaver<T>(v => saveRef.current(v), setStatus, delayMs)

  useEffect(() => {
    const s = saver.current!
    const onOnline = () => { if (s.hasPending()) void s.flush() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (s.hasPending()) { void s.flush(); e.preventDefault() } }
    const onHide = () => { if (document.visibilityState === 'hidden') void s.flush() }
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onHide)
      void s.flush() // leaving the note: save what's pending
    }
  }, [])

  return { update: (v: T) => saver.current!.update(v), flush: () => saver.current!.flush(), status }
}
```

- [ ] **Step 6: Write the failing Markdown round-trip test** `tests/unit/markdownRoundTrip.test.ts`

This pins the core promise of the notes design: switching Rich ↔ Markdown never loses content, including math.

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'

function roundTrip(md: string): string {
  const editor = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' })
  const out = editor.getMarkdown()
  editor.destroy()
  return out.trim()
}

describe('notes markdown round-trip', () => {
  it.each([
    '# Heading\n\nSome **bold** and *italic* text.',
    '- one\n- two',
    '1. first\n2. second',
    '- [ ] todo\n- [x] done',
    '```\ncode block\n```',
    'Inline math $x^2 + 1$ here.',
    '$$\n\\frac{a}{b}\n$$',
  ])('preserves %j', md => {
    expect(roundTrip(md)).toBe(md)
  })
})
```

- [ ] **Step 7: Run to verify failure** — `npm test -- markdownRoundTrip` → FAIL (module missing).

- [ ] **Step 8: Implement the shared extension list** `components/notes/extensions.ts`

```ts
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import Mathematics from '@tiptap/extension-mathematics'

export function noteExtensions() {
  return [
    StarterKit.configure({ link: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    Markdown,
  ]
}
```

- [ ] **Step 9: Run the round-trip test**

Run: `npm test -- markdownRoundTrip`
Expected: PASS. If a non-math case differs only by an equivalent Markdown spelling (e.g. the serializer emits `_italic_` instead of `*italic*`), change that test input to the serializer's canonical form — the requirement is a stable round-trip, not a particular spelling. If only the two math cases fail (the installed Mathematics extension has no Markdown tokenizer), add Markdown support to it in `components/notes/extensions.ts` and re-run until green:

```ts
import { InlineMath, BlockMath } from '@tiptap/extension-mathematics'

const InlineMathMd = InlineMath.extend({
  markdownTokenizer: {
    name: 'inlineMath', level: 'inline',
    start: (src: string) => src.indexOf('$'),
    tokenize: (src: string) => {
      const m = /^\$(?!\$)([^$\n]+?)\$/.exec(src)
      return m ? { type: 'inlineMath', raw: m[0], latex: m[1] } : undefined
    },
  },
  parseMarkdown: (token: { latex: string }) => ({ type: 'inlineMath', attrs: { latex: token.latex } }),
  renderMarkdown: (node: { attrs: { latex: string } }) => `$${node.attrs.latex}$`,
})

const BlockMathMd = BlockMath.extend({
  markdownTokenizer: {
    name: 'blockMath', level: 'block',
    start: (src: string) => src.indexOf('$$'),
    tokenize: (src: string) => {
      const m = /^\$\$\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(src)
      return m ? { type: 'blockMath', raw: m[0], latex: m[1] } : undefined
    },
  },
  parseMarkdown: (token: { latex: string }) => ({ type: 'blockMath', attrs: { latex: token.latex } }),
  renderMarkdown: (node: { attrs: { latex: string } }) => `$$\n${node.attrs.latex}\n$$`,
})
```

and use `InlineMathMd, BlockMathMd` in place of `Mathematics` in `noteExtensions()`. Check the current `@tiptap/markdown` docs ("custom extensions") for the exact tokenizer field names if the test still fails; the test is the source of truth.

- [ ] **Step 10: `components/notes/RichEditor.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Bold, Italic, Heading2, List, ListChecks, Code, Sigma } from 'lucide-react'
import { noteExtensions } from './extensions'

export function RichEditor({ markdown, onChange }: { markdown: string; onChange: (md: string) => void }) {
  const editor = useEditor({
    extensions: noteExtensions(),
    content: markdown,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose-note min-h-[50vh] outline-none py-3', 'aria-label': 'Note' } },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  })

  useEffect(() => () => editor?.destroy(), [editor])
  if (!editor) return null

  const tool = (label: string, Icon: typeof Bold, run: () => void, active = false) => (
    <button type="button" aria-label={label} title={label} onClick={run}
      className={`rounded p-1.5 ${active ? 'bg-surface text-fg' : 'text-muted hover:text-fg'}`}><Icon size={16} aria-hidden /></button>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-0.5 border-b border-line pb-1.5">
        {tool('Bold', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {tool('Italic', Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {tool('Heading', Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading'))}
        {tool('Bulleted list', List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {tool('Checklist', ListChecks, () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'))}
        {tool('Code', Code, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
        {tool('Equation', Sigma, () => {
          const latex = window.prompt('LaTeX', 'x^2')
          if (latex) editor.chain().focus().insertInlineMath({ latex }).run()
        })}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
```

- [ ] **Step 11: Notes list** `app/(app)/notes/page.tsx`

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseDot } from '@/components/ui/CourseDot'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote, listNotes } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import type { Course, NoteSummary } from '@/lib/types'

export default function NotesPage() {
  const router = useRouter()
  const toast = useToast()
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')

  useEffect(() => {
    const sb = supabase()
    Promise.all([listNotes(sb), listCourses(sb)]).then(([n, c]) => { setNotes(n); setCourses(c) })
  }, [])

  const shown = useMemo(() => (notes ?? []).filter(n =>
    (!course || n.course_id === course) && n.title.toLowerCase().includes(q.trim().toLowerCase())), [notes, q, course])

  async function create() {
    try {
      const n = await createNote(supabase(), { course_id: course || null })
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t create a note.') }
  }

  const courseOf = (id: string | null) => courses.find(c => c.id === id)

  return (
    <div>
      <PageHeader title="Notes" actions={<button className="btn" onClick={create}><Plus size={14} aria-hidden />Note</button>} />
      <div className="mb-3 flex gap-2">
        <input className="input flex-1" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        <select className="input" value={course} onChange={e => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {notes?.length === 0 && (
        <div className="card text-center">
          <p className="mb-3 text-sm text-muted">Write lecture notes, summaries and formulas. Math works too.</p>
          <button className="btn-primary" onClick={create}>Write your first note</button>
        </div>
      )}
      <div className="divide-y divide-line">
        {shown.map(n => (
          <Link key={n.id} href={`/notes/${n.id}`} className="flex items-center gap-2.5 py-2.5 hover:text-accent">
            <CourseDot color={courseOf(n.course_id)?.color} />
            <span className="flex-1 truncate">{n.title || 'Untitled'}</span>
            <span className="text-xs text-muted">{formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 12: Note editor page** `app/(app)/notes/[id]/page.tsx`

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { RichEditor } from '@/components/notes/RichEditor'
import { MarkdownView } from '@/components/notes/MarkdownView'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { deleteNote, getNote, updateNote } from '@/lib/data/notes'
import { listCourses } from '@/lib/data/courses'
import { useAutosave } from '@/lib/ui/useAutosave'
import type { Course, EditorMode, Note } from '@/lib/types'

type Patch = Partial<Pick<Note, 'title' | 'content_md' | 'course_id'>>
const STATUS_TEXT = { idle: '', pending: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved — will retry' } as const

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { profile } = useProfile()
  const [note, setNote] = useState<Note | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [mode, setMode] = useState<EditorMode>(profile.default_editor_mode)
  const [draft, setDraft] = useState<Note | null>(null)
  // Ref holds the latest draft: the Tiptap onUpdate callback is created once, so reading
  // `draft` state from it would merge onto a stale copy and drop title/course edits.
  const draftRef = useRef<Note | null>(null)
  const { update, status } = useAutosave<Patch>(patch => updateNote(supabase(), id, patch))

  useEffect(() => {
    const sb = supabase()
    Promise.all([getNote(sb, id), listCourses(sb)])
      .then(([n, c]) => { setNote(n); setDraft(n); draftRef.current = n; setCourses(c) })
      .catch(() => router.replace('/notes'))
  }, [id, router])

  function change(patch: Patch) {
    if (!draftRef.current) return
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    // Always save the full editable state so the latest value of every field wins
    update({ title: next.title, content_md: next.content_md, course_id: next.course_id })
  }

  async function remove() {
    if (!confirm('Delete this note?')) return
    try { await deleteNote(supabase(), id); router.replace('/notes') } catch { toast('Couldn\'t delete the note.') }
  }

  if (!note || !draft) return null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/notes" className="btn-ghost" aria-label="Back to notes"><ArrowLeft size={16} aria-hidden /></Link>
        <select className="input" value={draft.course_id ?? ''} onChange={e => change({ course_id: e.target.value || null })} aria-label="Course">
          <option value="">No course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-xs text-muted" aria-live="polite">{STATUS_TEXT[status]}</span>
        <div className="ml-auto flex items-center gap-1">
          <div role="tablist" className="flex rounded-lg bg-surface p-0.5">
            {(['rich', 'markdown'] as EditorMode[]).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-0.5 text-sm ${mode === m ? 'bg-bg font-medium' : 'text-muted'}`}>{m === 'rich' ? 'Rich' : 'Markdown'}</button>
            ))}
          </div>
          <button className="btn-ghost text-danger" onClick={remove} aria-label="Delete note"><Trash2 size={16} aria-hidden /></button>
        </div>
      </div>
      <input className="mb-2 w-full bg-transparent text-xl font-medium outline-none" value={draft.title} placeholder="Untitled"
        onChange={e => change({ title: e.target.value })} aria-label="Title" />
      {mode === 'rich' ? (
        <RichEditor key={`rich-${note.id}`} markdown={draft.content_md} onChange={md => change({ content_md: md })} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <textarea className="input min-h-[60vh] font-mono text-[13px]" value={draft.content_md} aria-label="Markdown"
            onChange={e => change({ content_md: e.target.value })} />
          <MarkdownView source={draft.content_md} className="min-h-[60vh] border-t border-line pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0" />
        </div>
      )}
    </div>
  )
}
```

Note: the `RichEditor` is keyed so that switching from Markdown back to Rich remounts it with the latest `draft.content_md`.

- [ ] **Step 13: Verify**

`npm test`, `npm run build` → pass. Manual: New note → type a heading, list, checklist, `$x^2$` (rendered as math in Rich) → "Saved" appears ~1s after typing stops → switch to Markdown → source shows `## …`, `- [ ]`, `$x^2$` → edit there → switch back to Rich → edits present → reload → content persists. Stop the local DB, type, see "Not saved — will retry"; restart DB, keep typing → "Saved". Type and immediately click Back → reopen → last text is there.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: notes with autosave and rich/markdown editor with math"
```

---

### Task 16: Progress and Settings

**Files:**
- Create: `app/(app)/progress/page.tsx`, `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `listSessionsSince`, `listReviewsSince`, `computeStreak`, `dailyMinutes`, `retention`, `countByDay`, `weekKeysFor`, `addDaysToKey`, `localDayKey`, `startOfLocalDay`, `updateProfile`, `useProfile`
- Produces: `/progress`, `/settings` pages

- [ ] **Step 1: Progress page** `app/(app)/progress/page.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { listSessionsSince } from '@/lib/data/focus'
import { listReviewsSince } from '@/lib/data/reviews'
import { computeStreak, dailyMinutes } from '@/lib/streak'
import { countByDay, retention } from '@/lib/stats'
import { addDaysToKey, localDayKey, startOfLocalDay, weekKeysFor } from '@/lib/dates'
import type { FocusSession, Review } from '@/lib/types'

const LEVELS = ['var(--surface)', '#B5D4F4', '#378ADD', '#185FA5']
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

export default function ProgressPage() {
  const { profile } = useProfile()
  const tz = profile.timezone
  const [sessions, setSessions] = useState<FocusSession[] | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    const sb = supabase()
    const today = localDayKey(new Date(), tz)
    // A year back so "best streak" is meaningful; the heatmap shows the last 12 weeks
    Promise.all([
      listSessionsSince(sb, startOfLocalDay(addDaysToKey(today, -365), tz)),
      listReviewsSince(sb, startOfLocalDay(addDaysToKey(today, -30), tz)),
    ]).then(([s, r]) => { setSessions(s); setReviews(r) })
  }, [tz])

  if (!sessions) return null

  const now = new Date()
  const today = localDayKey(now, tz)
  const minutes = dailyMinutes(sessions, tz)
  const streak = computeStreak(sessions, profile.daily_goal_minutes, tz, now)
  const thisWeek = weekKeysFor(today).reduce((n, k) => n + (minutes.get(k) ?? 0), 0)
  const ret = retention(reviews)
  const reviewsByDay = countByDay(reviews.map(r => r.reviewed_at), tz)

  const firstMonday = addDaysToKey(weekKeysFor(today)[0], -7 * 11)
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysToKey(firstMonday, w * 7 + d)))
  const level = (m: number) => (m <= 0 ? 0 : m < profile.daily_goal_minutes / 2 ? 1 : m < profile.daily_goal_minutes ? 2 : 3)
  const last14 = Array.from({ length: 14 }, (_, i) => addDaysToKey(today, i - 13))
  const maxReviews = Math.max(1, ...last14.map(k => reviewsByDay.get(k) ?? 0))

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted">{label}</div><div className="text-xl font-medium">{value}</div></div>
  )

  return (
    <div>
      <PageHeader title="Progress" />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Current streak" value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`} />
        <Stat label="Best streak" value={`${streak.best} ${streak.best === 1 ? 'day' : 'days'}`} />
        <Stat label="Focus this week" value={fmtMin(thisWeek)} />
        <Stat label="Retention (30 days)" value={ret === null ? '—' : `${Math.round(ret * 100)}%`} />
      </div>
      <section className="card mb-4">
        <h2 className="mb-2 text-sm font-medium">Focus, last 12 weeks</h2>
        <div className="flex gap-[3px] overflow-x-auto" role="img" aria-label="Daily focus time heatmap for the last 12 weeks">
          {weeks.map((days, i) => (
            <div key={i} className="grid gap-[3px]">
              {days.map(k => (
                <div key={k} title={`${k}: ${fmtMin(minutes.get(k) ?? 0)}`} className="size-3.5 rounded-[3px]"
                  style={{ background: k > today ? 'transparent' : LEVELS[level(minutes.get(k) ?? 0)] }} />
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Darkest = daily goal reached</p>
      </section>
      <section className="card">
        <h2 className="mb-2 text-sm font-medium">Cards reviewed, last 14 days</h2>
        <div className="flex h-24 items-end gap-1">
          {last14.map(k => {
            const n = reviewsByDay.get(k) ?? 0
            return (
              <div key={k} className="flex flex-1 flex-col items-center gap-1" title={`${k}: ${n}`}>
                <div className="w-full rounded-sm bg-accent" style={{ height: `${(n / maxReviews) * 80}px`, minHeight: n ? 2 : 0 }} />
                <span className="text-[10px] text-muted">{Number(k.slice(8))}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Settings page** `app/(app)/settings/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { PageHeader } from '@/components/ui/PageHeader'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/data/profile'
import type { EditorMode, Profile, ThemePref } from '@/lib/types'

export default function SettingsPage() {
  const { profile, setProfile } = useProfile()
  const toast = useToast()
  const router = useRouter()
  const { setTheme } = useTheme()
  const [form, setForm] = useState(profile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setForm(f => ({ ...f, [k]: v })); setError(null) }

  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [profile.timezone]

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const ints: [keyof Profile, number, number][] = [
      ['daily_goal_minutes', 1, 1440], ['focus_minutes', 1, 180], ['short_break_minutes', 1, 60],
      ['long_break_minutes', 1, 120], ['long_break_every', 1, 12],
    ]
    for (const [k, min, max] of ints) {
      const v = form[k] as number
      if (!Number.isInteger(v) || v < min || v > max) { setError(`Enter a whole number from ${min} to ${max}.`); return }
    }
    setBusy(true)
    try {
      const { id, ...patch } = form
      const saved = await updateProfile(supabase(), id, patch)
      setProfile(saved)
      setTheme(saved.theme)
      toast('Settings saved')
    } catch { toast('Couldn\'t save.') } finally { setBusy(false) }
  }

  async function signOut() {
    await supabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const num = (k: keyof Profile, label: string) => (
    <label className="field"><span>{label}</span>
      <input type="number" inputMode="numeric" value={form[k] as number} onChange={e => set(k, Number(e.target.value) as never)} />
    </label>
  )

  return (
    <form onSubmit={save} className="max-w-md space-y-5">
      <PageHeader title="Settings" />
      <section className="space-y-3">
        <label className="field"><span>Name</span><input value={form.display_name ?? ''} onChange={e => set('display_name', e.target.value || null)} /></label>
        <label className="field"><span>Time zone</span>
          <select value={form.timezone} onChange={e => set('timezone', e.target.value)}>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      </section>
      <section className="grid grid-cols-2 gap-3">
        {num('daily_goal_minutes', 'Daily focus goal (min)')}
        {num('focus_minutes', 'Focus length (min)')}
        {num('short_break_minutes', 'Short break (min)')}
        {num('long_break_minutes', 'Long break (min)')}
        {num('long_break_every', 'Long break every N sessions')}
      </section>
      <section className="grid grid-cols-2 gap-3">
        <label className="field"><span>Default note editor</span>
          <select value={form.default_editor_mode} onChange={e => set('default_editor_mode', e.target.value as EditorMode)}>
            <option value="rich">Rich</option><option value="markdown">Markdown</option>
          </select>
        </label>
        <label className="field"><span>Theme</span>
          <select value={form.theme} onChange={e => set('theme', e.target.value as ThemePref)}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
      </section>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-between">
        <button type="button" className="btn" onClick={signOut}>Sign out</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Verify**

`npm run build` → passes. Manual: Settings → set focus length 0 → "Enter a whole number from 1 to 180." → set 1 → Save → "Settings saved" → Focus page shows 01:00. Theme Dark → whole app switches and persists after reload. Progress shows streak/heatmap matching the sessions logged in Task 14. Sign out → `/login`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: progress stats and settings"
```

---

### Task 17: End-to-end tests and visual check

**Files:**
- Create: `e2e/helpers.ts`, `e2e/core.spec.ts`

**Interfaces:**
- Consumes: the running app (`npm run dev`) and local Supabase
- Produces: `npm run e2e` green on desktop and mobile projects

- [ ] **Step 1: Helpers** `e2e/helpers.ts`

```ts
import { expect, type Page } from '@playwright/test'

export async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ama')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password').fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('Your first course').fill('Biology')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/home/)
  return email
}
```

- [ ] **Step 2: Specs** `e2e/core.spec.ts`

```ts
import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

test('logged-out users are sent to login with a return path', async ({ page }) => {
  await page.goto('/planner')
  await expect(page).toHaveURL(/\/login\?next=%2Fplanner/)
})

test('signup rejects mismatched emails', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Email', { exact: true }).fill('a@example.test')
  await page.getByLabel('Confirm email').fill('b@example.test')
  await page.getByLabel('Password').fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toHaveText('Those emails don\'t match.')
})

test('add a task in the planner and complete it', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Calc problem set tomorrow')
  await expect(page.getByText('Due Tomorrow')).toBeVisible()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const row = page.getByText('Calc problem set', { exact: true })
  await expect(row).toBeVisible()
  await page.getByLabel('Mark Calc problem set done').check()
  await expect(row).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Calc problem set', { exact: true })).toHaveCount(0)
})

test('task added on home shows under Today', async ({ page }) => {
  await signUp(page)
  await page.getByLabel('Add a task').fill('Read chapter 4')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.reload()
  await expect(page.getByText('Read chapter 4')).toBeVisible()
})

test('create a deck, add cards, and review them', async ({ page }) => {
  await signUp(page)
  await page.goto('/flashcards')
  await page.getByRole('button', { name: 'Create a deck' }).click()
  await page.getByLabel('Name').fill('Cells')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Cells').click()
  for (const [f, b] of [['Mitochondria?', 'ATP'], ['Nucleus?', 'DNA']]) {
    await page.getByLabel('Front').fill(f)
    await page.getByLabel('Back').fill(b)
    await page.getByRole('button', { name: 'Add card' }).click()
    await expect(page.getByText(f)).toBeVisible()
  }
  await page.getByRole('link', { name: 'Review 2' }).click()
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Space')
    await page.keyboard.press('3')
  }
  await expect(page.getByText('Session complete')).toBeVisible()
  await expect(page.getByText('2 reviews')).toBeVisible()
})

test('a note persists after reload, including math', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await page.getByLabel('Title').fill('Quadratics')
  await page.getByRole('tab', { name: 'Markdown' }).click()
  await page.getByLabel('Markdown').fill('## Formula\n\n$x^2$')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'Markdown' }).click()
  await expect(page.getByLabel('Markdown')).toHaveValue('## Formula\n\n$x^2$')
  await expect(page.getByLabel('Title')).toHaveValue('Quadratics')
  await expect(page.locator('.katex').first()).toBeVisible()
})

test('focus timer runs and pauses', async ({ page }) => {
  await signUp(page)
  await page.goto('/focus')
  await expect(page.getByText('25:00')).toBeVisible()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText(/24:5\d/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/24:5\d/)).toBeVisible() // restored after reload
})
```

- [ ] **Step 3: Run E2E**

Run: `npx supabase start` (if not running), then `npm run e2e`.
Expected: all tests pass in both `desktop` and `mobile` projects. On a failure, open `npx playwright show-report` and fix the app (not the assertion) unless the assertion contradicts the spec.

- [ ] **Step 4: Visual check (manual)**

With `npm run dev`, check every page at 1280px and 375px wide, in light and dark: no horizontal page scroll (the week grid scrolls inside its own box), text readable in both themes, bottom tab bar on mobile, Home shows no streak/metrics/charts.

- [ ] **Step 5: Run everything**

```bash
npm test
npm run test:db
npm run e2e
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: end-to-end coverage for core flows"
```

---

## Deployment notes (after all tasks; needs the user)

These steps use the user's own accounts and credentials — the user performs them:
1. Create a Supabase project; run `npx supabase link` and `npx supabase db push` to apply the migration. In Auth settings, turn **off** "Confirm email" and enable the Google provider with their Google OAuth client.
2. Import the repo into Vercel; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` (the Vercel URL). Add `<vercel-url>/auth/callback` to Supabase Auth redirect URLs.
