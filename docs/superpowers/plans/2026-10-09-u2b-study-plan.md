# U2b Study Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student makes a study plan for a course from one of their exams, a mode and a daily time; today's sessions show as tick-off rows on Home and in the Planner; the plan is re-worked from their results each day; a Warm-up session starts a quiz.

**Architecture:** Two tables (`study_plans`, `study_plan_days`). A pure scheduler (`lib/plan/schedule.ts`) turns the topics' status, the exam date, the mode and the time into days of sessions. Each day's list is saved the first time that day is opened (so it does not reshuffle) and records what was ticked, which the scheduler reads as history. Future days are never stored. A loader assembles everything for the UI; one hook feeds Home and the Planner.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before page work, per AGENTS.md), React 19, Supabase (Postgres + RLS), Vitest (unit + DB), Playwright with the fake OpenAI.

**Spec:** `docs/superpowers/specs/2026-10-09-u2b-study-plan-design.md`

## Global Constraints

- No AI in the schedule. The only AI cost is a Warm-up quiz (1 action, via the existing quiz route).
- Modes: `sprint` (neediest 40% of topics, at least 3), `balanced` (80%), `deep` (all; mastered topics only here). Session minutes: Warm-up 10, Learn 25, Revise 15. Revise at least 2 study days after a Learn. The last 2 study days are kept for final revision (none when there are 2 or fewer study days).
- Weekday numbers are 0 to 6 with 0 = Sunday (`weekdayOfKey` in `lib/dates.ts`). Dates are the student's local day keys (`localDayKey(date, tz)`).
- The exam day is not a study day. A plan whose exam is done or whose day has come is hidden.
- One plan per course; the exam is a task of type `exam` in that course.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; git identity is kadubofour's noreply, never the Gmail.
- Never handle API keys or secrets. Do not push or merge to `main` without asking (main deploys).
- Windows project: write files containing backslashes with the Write/Edit tools; `.tsx` files may be CRLF (never `sed -i` on them; use Python edits that preserve line endings).
- Each task ends with its tests green, `npx eslint` and `npx tsc --noEmit` clean, and a commit.

## Review Focus

- A day's list must be created once and then stay put while the student works, even if two tabs open it at once (Tasks 1, 3).
- A Learn that was done must never be scheduled again, even though doing it does not change the topic's status (Task 2 history tests).
- Exam moved, deleted, marked done, or passed: the plan follows, vanishes, or is hidden, never errors (Tasks 1, 3).
- Minutes a day smaller than a session, one study day, no study days, days off covering everything: sensible results, no crash or empty-forever plan without a message (Task 2).
- A topic deleted after sessions were saved: its rows disappear instead of breaking the list (Task 3).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261017000000_study_plans.sql`, `tests/db/studyPlans.test.ts` | tables, RLS, rules |
| `lib/plan/types.ts`, `lib/plan/schedule.ts` | types; the pure scheduler |
| `lib/plan/history.ts` | history summary; stats to scheduler topics |
| `lib/plan/service.ts`, `lib/plan/load.ts` | data functions; loads and assembles `PlanView`s |
| `components/plan/usePlans.ts`, `SessionRow.tsx`, `PlanForm.tsx`, `StudyPlanPanel.tsx` | UI |
| `app/(app)/home/page.tsx`, `app/(app)/planner/page.tsx` (modify) | integration |
| `e2e/studyPlan.spec.ts` | E2E |

---

### Task 1: Database — plans and days

**Files:**
- Create: `supabase/migrations/20261017000000_study_plans.sql`, `tests/db/studyPlans.test.ts`

**Interfaces:**
- Produces (SQL): `study_plans(id, user_id, course_id, exam_task_id, mode, minutes_per_day, days_off, created_at)` (unique per course); `study_plan_days(id, user_id, plan_id, day date, sessions jsonb, created_at)` (unique per plan and day).
- Consumes: `owns_course`, `courses`, `tasks`.

- [ ] **Step 1: Write the failing DB tests**

Create `tests/db/studyPlans.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
const course = async (u: U, name = 'Biology') => (await u.sb.from('courses').insert({ name, color: '#1D9E75' }).select('id').single()).data!.id as string
const exam = async (u: U, courseId: string | null, type = 'exam') =>
  (await u.sb.from('tasks').insert({ title: 'Midterm', type, course_id: courseId, due_at: new Date(Date.now() + 14 * 86_400_000).toISOString() }).select('id').single()).data!.id as string
const plan = (u: U, courseId: string, examId: string, over: object = {}) =>
  u.sb.from('study_plans').insert({ course_id: courseId, exam_task_id: examId, ...over }).select('id').single()
const sessions = [{ id: 's1', topic_id: '11111111-1111-4111-8111-111111111111', kind: 'learn', minutes: 25, done_at: null }]

describe('study plans', () => {
  it('a student keeps their own plans; others cannot see or use them', async () => {
    const u = await newUser(), other = await newUser()
    const c = await course(u), e = await exam(u, c)
    const { data: p, error } = await plan(u, c, e)
    expect(error).toBeNull()
    expect((await other.sb.from('study_plans').select('id').eq('id', p!.id)).data).toEqual([])
    expect((await plan(other, c, e)).error).not.toBeNull() // someone else's course and exam
  })
  it('has sensible defaults, and rejects bad modes, minutes and days off', async () => {
    const u = await newUser()
    const c = await course(u), e = await exam(u, c)
    const { data: p } = await plan(u, c, e)
    expect((await u.sb.from('study_plans').select('mode,minutes_per_day,days_off').eq('id', p!.id).single()).data).toEqual({ mode: 'balanced', minutes_per_day: 45, days_off: [] })
    for (const bad of [{ mode: 'cram' }, { minutes_per_day: 5 }, { minutes_per_day: 241 }, { days_off: [7] }, { days_off: [-1] }]) {
      expect((await u.sb.from('study_plans').update(bad).eq('id', p!.id)).error, JSON.stringify(bad)).not.toBeNull()
    }
    expect((await u.sb.from('study_plans').update({ mode: 'deep', minutes_per_day: 120, days_off: [0, 6] }).eq('id', p!.id)).error).toBeNull()
  })
  it('is one plan per course, and the exam must be an exam task in that course', async () => {
    const u = await newUser()
    const c1 = await course(u, 'Bio'), c2 = await course(u, 'Chem')
    const e1 = await exam(u, c1)
    expect((await plan(u, c1, e1)).error).toBeNull()
    expect((await plan(u, c1, await exam(u, c1))).error).not.toBeNull() // a second plan for the course
    expect((await plan(u, c2, e1)).error).not.toBeNull()                 // the exam is in another course
    expect((await plan(u, c2, await exam(u, c2, 'assignment'))).error).not.toBeNull() // not an exam
    expect((await plan(u, c2, await exam(u, null))).error).not.toBeNull() // no course
  })
  it('deleting the exam, or the course, deletes the plan and its days', async () => {
    const u = await newUser()
    const c = await course(u), e = await exam(u, c)
    const { data: p } = await plan(u, c, e)
    await u.sb.from('study_plan_days').insert({ plan_id: p!.id, day: '2026-10-12', sessions })
    await u.sb.from('tasks').delete().eq('id', e)
    expect((await u.sb.from('study_plans').select('id').eq('id', p!.id)).data).toEqual([])
    expect((await u.sb.from('study_plan_days').select('id').eq('plan_id', p!.id)).data).toEqual([])
    const c2 = await course(u, 'Chem'), p2 = (await plan(u, c2, await exam(u, c2))).data!
    await u.sb.from('courses').delete().eq('id', c2)
    expect((await u.sb.from('study_plans').select('id').eq('id', p2.id)).data).toEqual([])
  })
})

describe('study plan days', () => {
  const setup = async () => {
    const u = await newUser()
    const c = await course(u), e = await exam(u, c)
    return { u, planId: (await plan(u, c, e)).data!.id as string }
  }
  it('holds one list per plan and day, private to the student', async () => {
    const { u, planId } = await setup()
    const other = await newUser()
    expect((await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-12', sessions })).error).toBeNull()
    expect((await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-12', sessions })).error).not.toBeNull()
    expect((await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-13', sessions: [] })).error).toBeNull()
    expect((await other.sb.from('study_plan_days').select('id').eq('plan_id', planId)).data).toEqual([])
    expect((await other.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-14', sessions: [] })).error).not.toBeNull()
  })
  it('opening the same day twice keeps the first list (upsert that ignores duplicates)', async () => {
    const { u, planId } = await setup()
    const first = [{ ...sessions[0], id: 'first' }], second = [{ ...sessions[0], id: 'second' }]
    await u.sb.from('study_plan_days').upsert({ plan_id: planId, day: '2026-10-12', sessions: first }, { onConflict: 'plan_id,day', ignoreDuplicates: true })
    await u.sb.from('study_plan_days').upsert({ plan_id: planId, day: '2026-10-12', sessions: second }, { onConflict: 'plan_id,day', ignoreDuplicates: true })
    const { data } = await u.sb.from('study_plan_days').select('sessions').eq('plan_id', planId).eq('day', '2026-10-12').single()
    expect((data!.sessions as { id: string }[])[0].id).toBe('first')
  })
  it('keeps sessions an array and can be updated to record what was done', async () => {
    const { u, planId } = await setup()
    const { data: row } = await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-12', sessions }).select('id').single()
    expect((await u.sb.from('study_plan_days').update({ sessions: { not: 'an array' } }).eq('id', row!.id)).error).not.toBeNull()
    const done = [{ ...sessions[0], done_at: '2026-10-12T10:00:00Z' }]
    expect((await u.sb.from('study_plan_days').update({ sessions: done }).eq('id', row!.id)).error).toBeNull()
    expect(((await u.sb.from('study_plan_days').select('sessions').eq('id', row!.id).single()).data!.sessions as { done_at: string }[])[0].done_at).toBe('2026-10-12T10:00:00Z')
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `export PATH="$PATH:/c/Users/Fii/AppData/Local/Programs/DockerDesktop/resources/bin" && npx vitest run tests/db/studyPlans.test.ts --mode test`
Expected: FAIL — `relation "public.study_plans" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261017000000_study_plans.sql`:

```sql
-- U2b: study plans (one per course, built from an exam task) and each day's saved list of sessions.

create function public.owns_task(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks t where t.id = tid and t.user_id = auth.uid())
$$;

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  exam_task_id uuid not null references public.tasks on delete cascade,
  mode text not null default 'balanced' check (mode in ('sprint', 'balanced', 'deep')),
  minutes_per_day int not null default 45 check (minutes_per_day between 10 and 240),
  -- weekday numbers, 0 is Sunday
  days_off int[] not null default '{}' check (days_off <@ array[0, 1, 2, 3, 4, 5, 6]),
  created_at timestamptz not null default now(),
  unique (course_id)
);
alter table public.study_plans enable row level security;
create policy "own rows" on public.study_plans for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_course(course_id) and public.owns_task(exam_task_id));

-- The exam must be an exam task in the plan's course
create function public.study_plan_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  exam_type text;
  exam_course uuid;
begin
  select t.type, t.course_id into exam_type, exam_course from public.tasks t where t.id = new.exam_task_id;
  if exam_type is distinct from 'exam' or exam_course is distinct from new.course_id then
    raise exception 'A study plan needs an exam task in the same course' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger study_plan_check before insert or update on public.study_plans for each row execute function public.study_plan_check();

create function public.owns_plan(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_plans p where p.id = pid and p.user_id = auth.uid())
$$;

-- A day's saved sessions: [{ id, topic_id, kind: 'warmup'|'learn'|'revise', minutes, done_at }]
create table public.study_plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id uuid not null references public.study_plans on delete cascade,
  day date not null,
  sessions jsonb not null default '[]'::jsonb check (jsonb_typeof(sessions) = 'array'),
  created_at timestamptz not null default now(),
  unique (plan_id, day)
);
alter table public.study_plan_days enable row level security;
create policy "own rows" on public.study_plan_days for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_plan(plan_id));
```

- [ ] **Step 4: Apply and run**

Run: `export PATH="$PATH:/c/Users/Fii/AppData/Local/Programs/DockerDesktop/resources/bin" && npx supabase migration up && npx vitest run tests/db/studyPlans.test.ts --mode test`
Expected: all PASS. (A SQL-language function checks its body when created, so a function that reads a table must come after that table, as `owns_plan` does.)

- [ ] **Step 5: Whole DB suite, then commit**

Run: `npm run test:db 2>&1 | tail -6` → all pass.

```bash
git add supabase/migrations/20261017000000_study_plans.sql tests/db/studyPlans.test.ts
git commit -m "feat: study plans and saved daily session lists

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The scheduler

**Files:**
- Create: `lib/plan/types.ts`, `lib/plan/schedule.ts`, `tests/unit/planSchedule.test.ts`

**Interfaces:**
- Consumes: `addDaysToKey`, `weekdayOfKey`, `DayKey` from `lib/dates.ts`; `TopicStatus` from `lib/topics/types.ts`.
- Produces: in `lib/plan/types.ts` — `PlanMode`, `SessionKind`, `PlanTopic`, `PlanSession`, `DayPlan`, `StoredSession`; in `lib/plan/schedule.ts` — `MINUTES`, `buildPlan(o): { status: 'ok' | 'no_topics' | 'exam_passed' | 'no_days'; days: DayPlan[]; unscheduled: PlanSession[] }` and `studyDays(today, examDay, daysOff): DayKey[]`.

- [ ] **Step 1: Write the types**

Create `lib/plan/types.ts`:

```ts
import type { TopicStatus } from '@/lib/topics/types'

export type PlanMode = 'sprint' | 'balanced' | 'deep'
export type SessionKind = 'warmup' | 'learn' | 'revise'

// One topic as the scheduler sees it: its status and numbers (from topic_stats), whether a Warm-up quiz can be made
// (it has a linked note), and what the saved plan days say was done
export type PlanTopic = {
  id: string; name: string; position: number; status: TopicStatus
  percent: number | null          // % right in the last 30 days; null with no answers
  lastPractised: string | null    // ISO time of the last answer
  hasNote: boolean
  learned: boolean; warmedUp: boolean
  lastStudied: string | null      // day key of the last session done for it
}
export type PlanSession = { topicId: string; kind: SessionKind; minutes: number }
export type DayPlan = { day: string; sessions: PlanSession[] }
// A session as saved in a day's list
export type StoredSession = { id: string; topic_id: string; kind: SessionKind; minutes: number; done_at: string | null }
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/planSchedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MINUTES, buildPlan, studyDays } from '@/lib/plan/schedule'
import { addDaysToKey, weekdayOfKey } from '@/lib/dates'
import type { PlanMode, PlanSession, PlanTopic } from '@/lib/plan/types'

const TODAY = '2026-10-12' // a Monday
const at = (n: number) => addDaysToKey(TODAY, n)
let seq = 0
const topic = (over: Partial<PlanTopic> = {}): PlanTopic => {
  const i = seq++
  return { id: `t${i}`, name: `Topic ${i}`, position: i, status: 'not_started', percent: null, lastPractised: null, hasNote: true, learned: false, warmedUp: false, lastStudied: null, ...over }
}
const run = (topics: PlanTopic[], over: Partial<Parameters<typeof buildPlan>[0]> = {}) =>
  buildPlan({ today: TODAY, examDay: at(30), mode: 'deep' as PlanMode, minutesPerDay: 60, daysOff: [], topics, ...over })
const all = (r: ReturnType<typeof run>) => r.days.flatMap(d => d.sessions.map(s => ({ ...s, day: d.day })))
const ids = (r: ReturnType<typeof run>) => new Set(all(r).map(s => s.topicId))

describe('study days', () => {
  it('runs from today to the day before the exam, minus days off', () => {
    expect(studyDays(TODAY, at(4), [])).toEqual([at(0), at(1), at(2), at(3)])
    expect(studyDays(TODAY, at(8), [0, 6]).every(d => ![0, 6].includes(weekdayOfKey(d)))).toBe(true)
    expect(studyDays(TODAY, at(8), [0, 6])).toEqual([at(0), at(1), at(2), at(3), at(4)]) // Mon to Fri; Sat and Sun skipped; exam on Tue
  })
  it('is empty when the exam is today or past', () => {
    expect(studyDays(TODAY, TODAY, [])).toEqual([])
    expect(studyDays(TODAY, at(-3), [])).toEqual([])
  })
})

describe('status', () => {
  it('reports why there is no plan', () => {
    expect(run([topic()], { examDay: TODAY }).status).toBe('exam_passed')
    expect(run([]).status).toBe('no_topics')
    expect(run([topic()], { examDay: at(3), daysOff: [1, 2, 3] }).status).toBe('no_days') // Mon, Tue, Wed all off
    const ok = run([topic()])
    expect(ok.status).toBe('ok')
    expect(ok.days.length).toBe(30)
  })
})

describe('modes', () => {
  const ten = () => Array.from({ length: 10 }, () => topic())
  it('Sprint covers the neediest 40% (at least 3), Balanced 80%, Deep dive all', () => {
    expect(ids(run(ten(), { mode: 'sprint' })).size).toBe(4)
    expect(ids(run(ten(), { mode: 'balanced' })).size).toBe(8)
    expect(ids(run(ten(), { mode: 'deep' })).size).toBe(10)
    expect(ids(run([topic(), topic()], { mode: 'sprint' })).size).toBe(2) // fewer than 3 topics: all of them
    expect(ids(run(Array.from({ length: 5 }, () => topic()), { mode: 'sprint' })).size).toBe(3) // 40% of 5 is 2: at least 3
  })
  it('only Deep dive includes mastered topics', () => {
    const mk = () => [topic({ status: 'mastered' }), topic({ status: 'mastered' }), topic(), topic(), topic()]
    const mastered = (r: ReturnType<typeof run>, list: PlanTopic[]) => list.filter(t => t.status === 'mastered' && ids(r).has(t.id)).length
    let list = mk(); expect(mastered(run(list, { mode: 'balanced' }), list)).toBe(0)
    list = mk(); expect(mastered(run(list, { mode: 'sprint' }), list)).toBe(0)
    list = mk(); expect(mastered(run(list, { mode: 'deep' }), list)).toBe(2)
  })
})

describe('what comes first and which sessions', () => {
  it('orders by need: weak (lowest percent first), then not started, then covered', () => {
    const covered = topic({ status: 'covered' }), fresh = topic(), weakB = topic({ status: 'weak', percent: 50 }), weakA = topic({ status: 'weak', percent: 20 })
    const first = run([covered, fresh, weakB, weakA], { minutesPerDay: 240, examDay: at(10) }).days[0].sessions
    expect(first.map(s => [s.topicId, s.kind])).toEqual([
      [weakA.id, 'learn'], [weakB.id, 'learn'], [fresh.id, 'warmup'], [fresh.id, 'learn'], [covered.id, 'revise'],
    ])
  })
  it('among equals, the longest since practised comes first, then the topic order', () => {
    const recent = topic({ status: 'covered', lastPractised: '2026-10-10T10:00:00Z' }), old = topic({ status: 'covered', lastPractised: '2026-09-01T10:00:00Z' })
    expect(run([recent, old], { examDay: at(10) }).days[0].sessions.map(s => s.topicId)).toEqual([old.id, recent.id])
  })
  it('a Warm-up only for a not-started topic that has a note and has not had one', () => {
    const kinds = (t: PlanTopic) => all(run([t], { examDay: at(10) })).filter(s => s.day === TODAY).map(s => s.kind)
    expect(kinds(topic())).toEqual(['warmup', 'learn'])
    expect(kinds(topic({ hasNote: false }))).toEqual(['learn'])
    expect(kinds(topic({ warmedUp: true }))).toEqual(['learn'])
    expect(kinds(topic({ learned: true, warmedUp: true }))).toEqual(['revise'])
  })
  it('a Learn that was done is not repeated, and a covered topic only gets revision', () => {
    const r = run([topic({ status: 'weak', percent: 30, learned: true }), topic({ status: 'covered' })], { examDay: at(10) })
    expect(all(r).some(s => s.kind === 'learn' || s.kind === 'warmup')).toBe(false)
  })
  it('uses the agreed minutes', () => {
    const s = run([topic()], { examDay: at(10) }).days[0].sessions
    expect(s.map(x => x.minutes)).toEqual([MINUTES.warmup, MINUTES.learn])
    expect([MINUTES.warmup, MINUTES.learn, MINUTES.revise]).toEqual([10, 25, 15])
  })
})

describe('placing sessions', () => {
  it('never puts more in a day than the minutes, except one session on its own', () => {
    const r = run(Array.from({ length: 6 }, () => topic({ hasNote: false })), { minutesPerDay: 60, examDay: at(14) })
    for (const d of r.days) {
      const total = d.sessions.reduce((n, s) => n + s.minutes, 0)
      expect(total <= 60 || d.sessions.length === 1, d.day).toBe(true)
    }
  })
  it('with minutes smaller than a session still schedules one session a day', () => {
    const r = run([topic({ hasNote: false }), topic({ hasNote: false })], { minutesPerDay: 10, examDay: at(6) })
    expect(r.days[0].sessions.map(s => s.kind)).toEqual(['learn'])
    expect(r.days[1].sessions.map(s => s.kind)).toEqual(['learn'])
  })
  it('with one study day everything that fits goes on it', () => {
    const r = run([topic()], { examDay: at(1) })
    expect(r.days).toHaveLength(1)
    expect(r.days[0].sessions.map(s => s.kind)).toEqual(['warmup', 'learn'])
  })
  it('keeps the last two days for final revision of every chosen topic', () => {
    const list = [topic(), topic(), topic()]
    const r = run(list, { examDay: at(10) })
    const last2 = r.days.slice(-2).flatMap(d => d.sessions)
    expect(last2.every(s => s.kind === 'revise')).toBe(true)
    expect(new Set(last2.map(s => s.topicId))).toEqual(new Set(list.map(t => t.id)))
    expect(r.days.slice(0, -2).flatMap(d => d.sessions).some(s => s.kind === 'revise')).toBe(true) // spaced revision earlier
  })
  it('revises a topic at least 2 days after its Learn', () => {
    const t = topic({ status: 'weak', percent: 10 })
    const r = run([t], { examDay: at(14) })
    const learnDay = all(r).find(s => s.kind === 'learn')!.day
    const revises = all(r).filter(s => s.kind === 'revise')
    expect(revises.length).toBeGreaterThan(0)
    expect(revises.every(s => s.day >= addDaysToKey(learnDay, 2))).toBe(true)
  })
  it('does not revise a topic studied today before 2 days have passed', () => {
    const t = topic({ status: 'covered', lastStudied: TODAY })
    const r = run([t], { examDay: at(14) })
    expect(all(r).filter(s => s.topicId === t.id).every(s => s.day >= at(2))).toBe(true)
  })
  it('lists what does not fit, and does not pretend otherwise', () => {
    const list = Array.from({ length: 10 }, () => topic({ hasNote: false }))
    const r = run(list, { minutesPerDay: 30, examDay: at(2) }) // two days, one Learn each
    expect(r.days.flatMap(d => d.sessions)).toHaveLength(2)
    expect(r.unscheduled).toHaveLength(8)
    expect(r.unscheduled.every((s: PlanSession) => s.kind === 'learn')).toBe(true)
  })
  it('skips days off and still fills the others', () => {
    const r = run([topic(), topic()], { examDay: at(8), daysOff: [0, 6] })
    expect(r.days.map(d => d.day)).toEqual([at(0), at(1), at(2), at(3), at(4)])
  })
})

describe('determinism', () => {
  it('gives the same plan for the same input', () => {
    const list = [topic({ status: 'weak', percent: 20 }), topic(), topic({ status: 'covered' })]
    expect(run(list, { examDay: at(12) })).toEqual(run(list, { examDay: at(12) }))
  })
})
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run tests/unit/planSchedule.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the scheduler**

Create `lib/plan/schedule.ts`:

```ts
import { addDaysToKey, weekdayOfKey, type DayKey } from '@/lib/dates'
import type { TopicStatus } from '@/lib/topics/types'
import type { DayPlan, PlanMode, PlanSession, PlanTopic, SessionKind } from './types'

export const MINUTES: Record<SessionKind, number> = { warmup: 10, learn: 25, revise: 15 }
const MODE_SHARE: Record<PlanMode, number> = { sprint: 0.4, balanced: 0.8, deep: 1 }
const MIN_SPRINT_TOPICS = 3
const SPACING_DAYS = 2
const RESERVED_DAYS = 2
const MAX_DAYS = 400
const NEED: Record<TopicStatus, number> = { weak: 0, not_started: 1, covered: 2, mastered: 3 }

// Every day from today to the day before the exam, except days off (weekday numbers, 0 is Sunday)
export function studyDays(today: DayKey, examDay: DayKey, daysOff: number[]): DayKey[] {
  const days: DayKey[] = []
  for (let d = today, n = 0; d < examDay && n < MAX_DAYS; d = addDaysToKey(d, 1), n++) {
    if (!daysOff.includes(weekdayOfKey(d))) days.push(d)
  }
  return days
}

const lastTime = (t: PlanTopic) => (t.lastPractised ? new Date(t.lastPractised).getTime() : 0)
// Weak first (lowest percent right first), then not started, then covered, then mastered; among equals the one
// practised longest ago, then the course's own order
const needOrder = (a: PlanTopic, b: PlanTopic) =>
  NEED[a.status] - NEED[b.status]
  || (a.status === 'weak' ? (a.percent ?? 0) - (b.percent ?? 0) : 0)
  || lastTime(a) - lastTime(b)
  || a.position - b.position

const session = (t: PlanTopic, kind: SessionKind): PlanSession => ({ topicId: t.id, kind, minutes: MINUTES[kind] })

function firstPass(t: PlanTopic): PlanSession[] {
  if (t.status === 'covered' || t.status === 'mastered') return [session(t, 'revise')]
  const out: PlanSession[] = []
  if (t.status === 'not_started' && t.hasNote && !t.warmedUp && !t.learned) out.push(session(t, 'warmup'))
  out.push(session(t, t.learned ? 'revise' : 'learn'))
  return out
}

export function buildPlan(o: {
  today: DayKey; examDay: DayKey; mode: PlanMode; minutesPerDay: number; daysOff: number[]; topics: PlanTopic[]
}): { status: 'ok' | 'no_topics' | 'exam_passed' | 'no_days'; days: DayPlan[]; unscheduled: PlanSession[] } {
  const none = (status: 'no_topics' | 'exam_passed' | 'no_days') => ({ status, days: [] as DayPlan[], unscheduled: [] as PlanSession[] })
  if (o.examDay <= o.today) return none('exam_passed')
  if (o.topics.length === 0) return none('no_topics')
  const days = studyDays(o.today, o.examDay, o.daysOff)
  if (days.length === 0) return none('no_days')

  // Which topics, by mode
  const n = o.topics.length
  const want = o.mode === 'deep' ? n : Math.min(n, Math.max(Math.min(MIN_SPRINT_TOPICS, n), Math.ceil(n * MODE_SHARE[o.mode])))
  const chosen = o.topics.filter(t => o.mode === 'deep' || t.status !== 'mastered').sort(needOrder).slice(0, want)

  const reserve = days.length > RESERVED_DAYS ? RESERVED_DAYS : 0
  const early = days.slice(0, days.length - reserve)
  const late = days.slice(days.length - reserve)
  const plan = new Map<DayKey, PlanSession[]>(days.map(d => [d, []]))
  const used = new Map<DayKey, number>(days.map(d => [d, 0]))

  // First day in `candidates` with room (a day always takes at least one session, even a long one)
  function place(s: PlanSession, candidates: DayKey[]): DayKey | null {
    for (const d of candidates) {
      const total = used.get(d)!
      if (total === 0 || total + s.minutes <= o.minutesPerDay) {
        plan.get(d)!.push(s); used.set(d, total + s.minutes)
        return d
      }
    }
    return null
  }

  const unscheduled: PlanSession[] = []
  const learnDay = new Map<string, DayKey>()
  for (const t of chosen) {
    // A topic studied recently is not revised again until 2 days have passed
    const earliest = t.lastStudied ? addDaysToKey(t.lastStudied, SPACING_DAYS) : null
    for (const s of firstPass(t)) {
      const candidates = s.kind === 'revise' && earliest ? early.filter(d => d >= earliest) : early
      if (candidates.length === 0) continue // nothing to place it on because of the spacing: final revision covers it
      const day = place(s, candidates)
      if (!day) unscheduled.push(s)
      else if (s.kind === 'learn') learnDay.set(t.id, day)
    }
  }
  // Revise each Learn again, at least 2 study days later, where there is room
  for (const t of chosen) {
    const at = learnDay.get(t.id)
    if (!at) continue
    const from = early.indexOf(at) + SPACING_DAYS
    if (from < early.length) place(session(t, 'revise'), early.slice(from))
  }
  // Final revision of every chosen topic on the reserved days, as many as fit
  for (const t of chosen) if (late.length) place(session(t, 'revise'), late)

  return { status: 'ok', days: days.map(d => ({ day: d, sessions: plan.get(d)! })), unscheduled }
}
```

- [ ] **Step 5: Run to see them pass, plus lint and types**

Run: `npx vitest run tests/unit/planSchedule.test.ts && npx eslint lib tests && npx tsc --noEmit`
Expected: PASS, clean. If one assertion fails, read it against the spec's rules (section 4) first: fix the code if it breaks a rule, and fix the test only if it asserts something the spec does not say (and note it).

- [ ] **Step 6: Commit**

```bash
git add lib/plan tests/unit/planSchedule.test.ts
git commit -m "feat: the study plan scheduler

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: History, saved days, and the loader

**Files:**
- Create: `lib/plan/history.ts`, `lib/plan/service.ts`, `lib/plan/load.ts`, `tests/unit/planHistory.test.ts`, `tests/unit/planLoad.test.ts`

**Interfaces:**
- Consumes: Task 2 types and `buildPlan`; `listTopicStats`, `listTopicLinks` (`lib/data/topics.ts`); `TopicStat`.
- Produces:
  - `lib/plan/history.ts`: `type DoneSession = { topicId: string; kind: SessionKind; day: string }`; `summariseHistory(done: DoneSession[]): Map<string, { learned: boolean; warmedUp: boolean; lastStudied: string | null }>`; `toPlanTopics(stats: TopicStat[], noteTopicIds: Set<string>, history: ReturnType<typeof summariseHistory>): PlanTopic[]`
  - `lib/plan/service.ts`: `type PlanRow = { id; course_id; exam_task_id; mode: PlanMode; minutes_per_day: number; days_off: number[]; exam: { id: string; title: string; due_at: string | null; done_at: string | null } }`; `type DayRow = { id: string; plan_id: string; day: string; sessions: StoredSession[] }`; `listPlans(sb)`, `savePlan(sb, input, id?)`, `deletePlan(sb, id)`, `listPlanDays(sb, planId)`, `ensureDay(sb, planId, day, sessions)`, `saveDaySessions(sb, dayId, sessions)`
  - `lib/plan/load.ts`: `type SessionView = StoredSession & { topicName: string; noteId: string | null }`; `type ScheduledView = PlanSession & { topicName: string; noteId: string | null }`; `type PlanView = { plan: PlanRow; courseId: string; examDay: string; daysToExam: number; status: 'ok' | 'no_topics' | 'exam_passed' | 'no_days'; todayDayId: string | null; today: SessionView[]; upcoming: { day: string; sessions: ScheduledView[] }[]; schedule: { day: string; sessions: ScheduledView[] }[]; unscheduled: number; missed: number }`; `loadPlans(sb, tz, now): Promise<PlanView[]>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/planHistory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { summariseHistory, toPlanTopics } from '@/lib/plan/history'
import type { TopicStat } from '@/lib/topics/types'

const stat = (over: Partial<TopicStat> = {}): TopicStat => ({
  topic_id: 't1', name: 'Krebs', position: 1, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 0, lectures: 0, decks: 0, status: 'not_started', ...over,
})

describe('summariseHistory', () => {
  it('says what was done for each topic and when it was last studied', () => {
    const h = summariseHistory([
      { topicId: 't1', kind: 'warmup', day: '2026-10-10' }, { topicId: 't1', kind: 'learn', day: '2026-10-11' },
      { topicId: 't1', kind: 'revise', day: '2026-10-09' }, { topicId: 't2', kind: 'revise', day: '2026-10-08' },
    ])
    expect(h.get('t1')).toEqual({ learned: true, warmedUp: true, lastStudied: '2026-10-11' })
    expect(h.get('t2')).toEqual({ learned: false, warmedUp: false, lastStudied: '2026-10-08' })
    expect(h.get('t3')).toBeUndefined()
  })
})

describe('toPlanTopics', () => {
  it('turns the stats into scheduler topics with the history', () => {
    const history = summariseHistory([{ topicId: 't1', kind: 'learn', day: '2026-10-11' }])
    const [t] = toPlanTopics([stat({ answers_30d: 8, correct_30d: 6, last_practised: '2026-10-05T10:00:00Z', status: 'covered' })], new Set(['t1']), history)
    expect(t).toEqual({
      id: 't1', name: 'Krebs', position: 1, status: 'covered', percent: 75, lastPractised: '2026-10-05T10:00:00Z',
      hasNote: true, learned: true, warmedUp: false, lastStudied: '2026-10-11',
    })
  })
  it('has no percent without answers, and no note unless one is linked', () => {
    const [t] = toPlanTopics([stat()], new Set(), new Map())
    expect(t).toMatchObject({ percent: null, hasNote: false, learned: false, warmedUp: false, lastStudied: null })
  })
})
```

Create `tests/unit/planLoad.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DayRow, PlanRow } from '@/lib/plan/service'
import type { TopicStat } from '@/lib/topics/types'

const TZ = 'UTC'
const NOW = new Date('2026-10-12T09:00:00Z') // Monday
const stat = (id: string, name: string, over: Partial<TopicStat> = {}): TopicStat => ({
  topic_id: id, name, position: 1, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 1, lectures: 0, decks: 0, status: 'not_started', ...over,
})
const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'p1', course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 60, days_off: [],
  exam: { id: 'e1', title: 'Midterm', due_at: '2026-10-26T09:00:00Z', done_at: null }, ...over,
})
let plans: PlanRow[], days: DayRow[], stats: TopicStat[], links: { topic_id: string; link: { kind: 'note' | 'lecture' | 'deck'; id: string } }[]
const ensureDay = vi.fn(async (_sb: unknown, planId: string, day: string, sessions: DayRow['sessions']) => ({ id: `d-${day}`, plan_id: planId, day, sessions }))
const sb = { from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'n1', updated_at: '2026-10-01T00:00:00Z' }, { id: 'n2', updated_at: '2026-10-05T00:00:00Z' }], error: null }) }) }) }
vi.mock('@/lib/plan/service', () => ({
  listPlans: async () => plans, listPlanDays: async () => days, ensureDay: (...a: unknown[]) => ensureDay(...(a as [unknown, string, string, DayRow['sessions']])),
}))
vi.mock('@/lib/data/topics', () => ({ listTopicStats: async () => stats, listTopicLinks: async () => links }))
import { loadPlans } from '@/lib/plan/load'

beforeEach(() => {
  plans = [plan()]; days = []; ensureDay.mockClear()
  stats = [stat('t1', 'Krebs cycle', { status: 'weak', answers_30d: 10, correct_30d: 3 }), stat('t2', 'Glycolysis')]
  links = [{ topic_id: 't1', link: { kind: 'note', id: 'n1' } }, { topic_id: 't2', link: { kind: 'note', id: 'n1' } }, { topic_id: 't2', link: { kind: 'note', id: 'n2' } }]
})
const load = () => loadPlans(sb as never, TZ, NOW)

describe('loadPlans', () => {
  it('saves today\'s list the first time the day is opened, with topic names and the newest linked note', async () => {
    const [v] = await load()
    expect(ensureDay).toHaveBeenCalledTimes(1)
    expect(ensureDay.mock.calls[0][2]).toBe('2026-10-12')
    expect(v.status).toBe('ok')
    expect(v.daysToExam).toBe(14)
    expect(v.today.length).toBeGreaterThan(0)
    expect(v.today[0]).toMatchObject({ topic_id: 't1', kind: 'learn', topicName: 'Krebs cycle', done_at: null, noteId: 'n1' })
    expect(v.today.find(s => s.topic_id === 't2')!.noteId).toBe('n2') // newest of its notes
    expect(v.todayDayId).toBe('d-2026-10-12')
  })
  it('uses the saved list when the day was already opened, and does not save again', async () => {
    days = [{ id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [{ id: 's1', topic_id: 't2', kind: 'learn', minutes: 25, done_at: null }] }]
    const [v] = await load()
    expect(ensureDay).not.toHaveBeenCalled()
    expect(v.today.map(s => s.id)).toEqual(['s1'])
    expect(v.todayDayId).toBe('d1')
  })
  it('plans the next days from tomorrow, and reads what was done as history', async () => {
    days = [
      { id: 'd0', plan_id: 'p1', day: '2026-10-11', sessions: [{ id: 'a', topic_id: 't1', kind: 'learn', minutes: 25, done_at: '2026-10-11T10:00:00Z' }] },
      { id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [] },
    ]
    const [v] = await load()
    expect(v.upcoming[0].day).toBe('2026-10-13')
    expect(v.upcoming).toHaveLength(7)
    const upcomingKinds = v.schedule.flatMap(d => d.sessions).filter(s => s.topicId === 't1').map(s => s.kind)
    expect(upcomingKinds).not.toContain('learn') // that Learn was done yesterday
    expect(v.schedule[0].day).toBe('2026-10-13')
  })
  it('counts sessions missed in the last 7 days, not today\'s', async () => {
    days = [
      { id: 'd0', plan_id: 'p1', day: '2026-10-10', sessions: [{ id: 'a', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null }, { id: 'b', topic_id: 't2', kind: 'learn', minutes: 25, done_at: '2026-10-10T10:00:00Z' }] },
      { id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [{ id: 'c', topic_id: 't1', kind: 'revise', minutes: 15, done_at: null }] },
      { id: 'dOld', plan_id: 'p1', day: '2026-09-01', sessions: [{ id: 'z', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null }] },
    ]
    expect((await load())[0].missed).toBe(1)
  })
  it('hides plans whose exam is done, has no date, or has come', async () => {
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-26T09:00:00Z', done_at: '2026-10-11T00:00:00Z' } })]
    expect(await load()).toEqual([])
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: null, done_at: null } })]
    expect(await load()).toEqual([])
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-12T15:00:00Z', done_at: null } })]
    expect(await load()).toEqual([])
  })
  it('says there are no topics, without saving a day', async () => {
    stats = []
    const [v] = await load()
    expect(v.status).toBe('no_topics')
    expect(v.today).toEqual([])
    expect(ensureDay).not.toHaveBeenCalled()
  })
  it('drops sessions of a topic that no longer exists', async () => {
    days = [{ id: 'd1', plan_id: 'p1', day: '2026-10-12', sessions: [
      { id: 's1', topic_id: 'gone', kind: 'learn', minutes: 25, done_at: null }, { id: 's2', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null },
    ] }]
    expect((await load())[0].today.map(s => s.id)).toEqual(['s2'])
  })
  it('tomorrow is the exam: only today is planned', async () => {
    plans = [plan({ exam: { id: 'e1', title: 'M', due_at: '2026-10-13T09:00:00Z', done_at: null } })]
    const [v] = await load()
    expect(v.upcoming).toEqual([])
    expect(v.today.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/planHistory.test.ts tests/unit/planLoad.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement history**

Create `lib/plan/history.ts`:

```ts
import type { TopicStat } from '@/lib/topics/types'
import type { PlanTopic, SessionKind } from './types'

export type DoneSession = { topicId: string; kind: SessionKind; day: string }
export type History = Map<string, { learned: boolean; warmedUp: boolean; lastStudied: string | null }>

// What the saved days say was done: doing a Learn does not change a topic's status, so this is how the plan
// knows not to give it again
export function summariseHistory(done: DoneSession[]): History {
  const out: History = new Map()
  for (const d of done) {
    const h = out.get(d.topicId) ?? { learned: false, warmedUp: false, lastStudied: null }
    if (d.kind === 'learn') h.learned = true
    if (d.kind === 'warmup') h.warmedUp = true
    if (!h.lastStudied || d.day > h.lastStudied) h.lastStudied = d.day
    out.set(d.topicId, h)
  }
  return out
}

export function toPlanTopics(stats: TopicStat[], noteTopicIds: Set<string>, history: History): PlanTopic[] {
  return stats.map(s => {
    const h = history.get(s.topic_id)
    return {
      id: s.topic_id, name: s.name, position: s.position, status: s.status,
      percent: s.answers_30d ? Math.round((s.correct_30d / s.answers_30d) * 100) : null,
      lastPractised: s.last_practised, hasNote: noteTopicIds.has(s.topic_id),
      learned: h?.learned ?? false, warmedUp: h?.warmedUp ?? false, lastStudied: h?.lastStudied ?? null,
    }
  })
}
```

- [ ] **Step 4: Implement the data functions**

Create `lib/plan/service.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { check, must } from '@/lib/data/util'
import type { PlanMode, StoredSession } from './types'

export type PlanRow = {
  id: string; course_id: string; exam_task_id: string; mode: PlanMode; minutes_per_day: number; days_off: number[]
  exam: { id: string; title: string; due_at: string | null; done_at: string | null }
}
export type DayRow = { id: string; plan_id: string; day: string; sessions: StoredSession[] }
export type PlanInput = { course_id: string; exam_task_id: string; mode: PlanMode; minutes_per_day: number; days_off: number[] }

const PLAN = 'id,course_id,exam_task_id,mode,minutes_per_day,days_off,exam:tasks!inner(id,title,due_at,done_at)'
const DAY = 'id,plan_id,day,sessions'

export async function listPlans(sb: SupabaseClient): Promise<PlanRow[]> {
  return must(await sb.from('study_plans').select(PLAN).order('created_at')) as unknown as PlanRow[]
}
export async function savePlan(sb: SupabaseClient, input: PlanInput, id?: string): Promise<void> {
  if (id) check(await sb.from('study_plans').update({ mode: input.mode, minutes_per_day: input.minutes_per_day, days_off: input.days_off }).eq('id', id))
  else check(await sb.from('study_plans').insert(input))
}
export async function deletePlan(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('study_plans').delete().eq('id', id))
}
export async function listPlanDays(sb: SupabaseClient, planId: string): Promise<DayRow[]> {
  return must(await sb.from('study_plan_days').select(DAY).eq('plan_id', planId).order('day')) as unknown as DayRow[]
}
// Saves a day's list the first time; if another tab got there first, theirs is kept and returned
export async function ensureDay(sb: SupabaseClient, planId: string, day: string, sessions: StoredSession[]): Promise<DayRow> {
  check(await sb.from('study_plan_days').upsert({ plan_id: planId, day, sessions }, { onConflict: 'plan_id,day', ignoreDuplicates: true }))
  return must(await sb.from('study_plan_days').select(DAY).eq('plan_id', planId).eq('day', day).single()) as unknown as DayRow
}
export async function saveDaySessions(sb: SupabaseClient, dayId: string, sessions: StoredSession[]): Promise<void> {
  check(await sb.from('study_plan_days').update({ sessions }).eq('id', dayId))
}
```

- [ ] **Step 5: Implement the loader**

Create `lib/plan/load.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { listTopicLinks, listTopicStats } from '@/lib/data/topics'
import { addDaysToKey, localDayKey, type DayKey } from '@/lib/dates'
import { summariseHistory, toPlanTopics, type DoneSession } from './history'
import { buildPlan } from './schedule'
import { ensureDay, listPlanDays, listPlans, type PlanRow } from './service'
import type { PlanSession, StoredSession } from './types'

export type SessionView = StoredSession & { topicName: string; noteId: string | null }
export type ScheduledView = PlanSession & { topicName: string; noteId: string | null }
export type PlanView = {
  plan: PlanRow; courseId: string; examDay: DayKey; daysToExam: number
  status: 'ok' | 'no_topics' | 'exam_passed' | 'no_days'
  todayDayId: string | null; today: SessionView[]
  upcoming: { day: DayKey; sessions: ScheduledView[] }[] // the next 7 study days after today
  schedule: { day: DayKey; sessions: ScheduledView[] }[] // every study day after today
  unscheduled: number; missed: number
}

const daysBetween = (a: DayKey, b: DayKey) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

// Everything the plan screens need, worked out from the saved plans, the topics' results and the saved days.
// Today's list is saved the first time the day is opened; later days are always planned fresh.
export async function loadPlans(sb: SupabaseClient, tz: string, now: Date): Promise<PlanView[]> {
  const today = localDayKey(now, tz)
  const tomorrow = addDaysToKey(today, 1)
  const views: PlanView[] = []
  for (const plan of await listPlans(sb)) {
    if (!plan.exam.due_at || plan.exam.done_at) continue
    const examDay = localDayKey(plan.exam.due_at, tz)
    if (examDay <= today) continue

    const [stats, links, saved] = await Promise.all([listTopicStats(sb, plan.course_id), listTopicLinks(sb, plan.course_id), listPlanDays(sb, plan.id)])
    // The newest linked note of each topic, for Warm-ups and Open links
    const noteIds = [...new Set(links.filter(l => l.link.kind === 'note').map(l => l.link.id))]
    const updated = new Map<string, string>()
    if (noteIds.length) {
      const { data } = await sb.from('notes').select('id,updated_at').in('id', noteIds)
      for (const n of (data ?? []) as { id: string; updated_at: string }[]) updated.set(n.id, n.updated_at)
    }
    const noteOf = new Map<string, string>()
    for (const l of links) {
      if (l.link.kind !== 'note') continue
      const cur = noteOf.get(l.topic_id)
      if (!cur || (updated.get(l.link.id) ?? '') > (updated.get(cur) ?? '')) noteOf.set(l.topic_id, l.link.id)
    }
    const names = new Map(stats.map(s => [s.topic_id, s.name]))
    const dress = (s: PlanSession): ScheduledView | null => (names.has(s.topicId) ? { ...s, topicName: names.get(s.topicId)!, noteId: noteOf.get(s.topicId) ?? null } : null)

    const done: DoneSession[] = saved.flatMap(d => d.sessions.filter(s => s.done_at).map(s => ({ topicId: s.topic_id, kind: s.kind, day: d.day })))
    const topics = toPlanTopics(stats, new Set(noteOf.keys()), summariseHistory(done))
    const settings = { examDay, mode: plan.mode, minutesPerDay: plan.minutes_per_day, daysOff: plan.days_off, topics }

    // Today: the saved list, or plan it now and save it (nothing is saved when there is nothing to do yet)
    const full = buildPlan({ today, ...settings })
    let todayRow = saved.find(d => d.day === today) ?? null
    if (!todayRow) {
      const planned = full.days.find(d => d.day === today)?.sessions ?? []
      if (planned.length) todayRow = await ensureDay(sb, plan.id, today, planned.map(s => ({ id: crypto.randomUUID(), topic_id: s.topicId, kind: s.kind, minutes: s.minutes, done_at: null })))
    }
    const todayViews: SessionView[] = (todayRow?.sessions ?? []).flatMap(s =>
      names.has(s.topic_id) ? [{ ...s, topicName: names.get(s.topic_id)!, noteId: noteOf.get(s.topic_id) ?? null }] : [])

    // The days after today, planned from tomorrow with what is known now
    const future = tomorrow < examDay ? buildPlan({ today: tomorrow, ...settings }) : null
    const schedule = (future?.days ?? []).map(d => ({ day: d.day, sessions: d.sessions.flatMap(s => dress(s) ?? []) }))

    const weekAgo = addDaysToKey(today, -7)
    const missed = saved.filter(d => d.day >= weekAgo && d.day < today).reduce((n, d) => n + d.sessions.filter(s => !s.done_at && names.has(s.topic_id)).length, 0)

    views.push({
      plan, courseId: plan.course_id, examDay, daysToExam: daysBetween(today, examDay), status: full.status,
      todayDayId: todayRow?.id ?? null, today: todayViews, upcoming: schedule.slice(0, 7), schedule,
      unscheduled: (future ?? full).unscheduled.length, missed,
    })
  }
  return views
}
```

- [ ] **Step 6: Run to see them pass, plus lint and types**

Run: `npx vitest run tests/unit/planHistory.test.ts tests/unit/planLoad.test.ts tests/unit/planSchedule.test.ts && npx eslint lib tests && npx tsc --noEmit`
Expected: PASS, clean. (If the "newest note" assertion fails, check the `sb` stub in the test matches how `notes` is queried: `select(...).in(...)`.)

- [ ] **Step 7: Commit**

```bash
git add lib/plan tests/unit/planHistory.test.ts tests/unit/planLoad.test.ts
git commit -m "feat: plan history, saved days and the loader

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: Session rows, the plan hook, and Home

**Files:**
- Create: `components/plan/SessionRow.tsx`, `components/plan/usePlans.ts`, `components/plan/useWarmup.ts`, `tests/unit/sessionRow.test.tsx`, `tests/unit/usePlans.test.tsx`
- Modify: `app/(app)/home/page.tsx`

**Interfaces:**
- Consumes: `loadPlans`, `PlanView`, `SessionView` (Task 3); `saveDaySessions` (service); `postAi`/`AiError`; `useProfile`, `useSaver`; `Course`.
- Produces:
  - `KIND_LABEL: { warmup: 'Warm-up'; learn: 'Learn'; revise: 'Revise' }`
  - `<SessionRow s={SessionView} course?={Course} done={boolean} onToggle onWarmup? warmingUp? />` — checkbox named `Mark <Kind>: <topic> done`; shows minutes; **Open** link to `/notes/<noteId>` (or `/progress` with no note); a Warm-up with a note shows **Start warm-up** instead
  - `usePlans(): { views: PlanView[] | null; reload(): void; setDone(planId: string, sessionId: string, done: boolean): void }`
  - `useWarmup(): { busy: string | null; error: { code: string; message: string } | null; start(s: { id: string; noteId: string | null }): Promise<void> }` — calls `POST /api/ai/quiz` with `{ noteId, count: 5, types: ['mcq','true_false','short'] }` and opens `/quiz/<id>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sessionRow.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SessionRow } from '@/components/plan/SessionRow'
import type { SessionView } from '@/lib/plan/load'

afterEach(cleanup)
const s = (over: Partial<SessionView> = {}): SessionView => ({ id: 's1', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null, topicName: 'Krebs cycle', noteId: 'n1', ...over })
const course = { id: 'c1', name: 'Biology', color: '#1D9E75' }
const row = (over: Partial<SessionView> = {}, props: Partial<React.ComponentProps<typeof SessionRow>> = {}) =>
  render(<SessionRow s={s(over)} course={course} done={false} onToggle={() => {}} {...props} />)

describe('SessionRow', () => {
  it('shows the kind, the topic, the course and the minutes, with an Open link to the note', () => {
    row()
    expect(screen.getByText('Learn: Krebs cycle')).toBeTruthy()
    expect(screen.getByText('25 min')).toBeTruthy()
    expect(screen.getByText('Biology')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/notes/n1')
  })
  it('opens Topics on Progress when the topic has no note', () => {
    row({ noteId: null })
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/progress')
  })
  it('ticks and unticks', () => {
    const onToggle = vi.fn()
    row({}, { onToggle })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Learn: Krebs cycle done' }))
    expect(onToggle).toHaveBeenCalled()
    cleanup()
    row({ done_at: 'x' }, { done: true })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Learn: Krebs cycle').className).toMatch(/line-through/)
  })
  it('a Warm-up starts the quiz instead of Open, and shows when it is working', () => {
    const onWarmup = vi.fn()
    row({ kind: 'warmup', minutes: 10 }, { onWarmup })
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start warm-up' }))
    expect(onWarmup).toHaveBeenCalled()
    cleanup()
    row({ kind: 'warmup' }, { onWarmup, warmingUp: true })
    expect(screen.getByRole('button', { name: 'Making quiz…' })).toBeTruthy()
  })
})
```

Create `tests/unit/usePlans.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import type { PlanView, SessionView } from '@/lib/plan/load'
import type { Profile } from '@/lib/types'

const session = (id: string, over: Partial<SessionView> = {}): SessionView => ({ id, topic_id: 't1', kind: 'learn', minutes: 25, done_at: null, topicName: 'Krebs', noteId: 'n1', ...over })
const view = (sessions: SessionView[]): PlanView => ({
  plan: { id: 'p1', course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 45, days_off: [], exam: { id: 'e1', title: 'Midterm', due_at: '2026-10-26T00:00:00Z', done_at: null } },
  courseId: 'c1', examDay: '2026-10-26', daysToExam: 14, status: 'ok', todayDayId: 'day1', today: sessions, upcoming: [], schedule: [], unscheduled: 0, missed: 0,
})
let views: PlanView[]
const saveDaySessions = vi.fn(async (..._a: unknown[]) => {})
let failing = false
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
vi.mock('@/lib/plan/load', () => ({ loadPlans: async () => views }))
vi.mock('@/lib/plan/service', () => ({ saveDaySessions: (...a: unknown[]) => (failing ? Promise.reject(new Error('offline')) : saveDaySessions(...a)) }))
import { usePlans } from '@/components/plan/usePlans'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const profile = { id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true } as Profile
const wrapper = ({ children }: { children: React.ReactNode }) => <ToastProvider><ProfileProvider initial={profile}>{children}</ProfileProvider></ToastProvider>
const open = async () => { const h = renderHook(() => usePlans(), { wrapper }); await waitFor(() => expect(h.result.current.views).not.toBeNull()); return h }
beforeEach(() => { views = [view([session('a'), session('b', { topic_id: 't2' })])]; saveDaySessions.mockClear(); failing = false })
afterEach(cleanup)

describe('usePlans', () => {
  it('loads the plans', async () => {
    const h = await open()
    expect(h.result.current.views![0].today.map(s => s.id)).toEqual(['a', 'b'])
  })
  it('ticking marks a session done at once and saves the day\'s list without the display fields', async () => {
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true) })
    expect(h.result.current.views![0].today[0].done_at).not.toBeNull()
    const saved = saveDaySessions.mock.calls[0]
    expect(saved[1]).toBe('day1')
    expect(saved[2]).toEqual([
      { id: 'a', topic_id: 't1', kind: 'learn', minutes: 25, done_at: expect.any(String) },
      { id: 'b', topic_id: 't2', kind: 'learn', minutes: 25, done_at: null },
    ])
  })
  it('unticking clears it', async () => {
    views = [view([session('a', { done_at: '2026-10-12T10:00:00Z' })])]
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', false) })
    expect(h.result.current.views![0].today[0].done_at).toBeNull()
    expect((saveDaySessions.mock.calls[0][2] as { done_at: string | null }[])[0].done_at).toBeNull()
  })
  it('two quick ticks both stick', async () => {
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true); h.result.current.setDone('p1', 'b', true) })
    expect(h.result.current.views![0].today.every(s => s.done_at)).toBe(true)
    const last = saveDaySessions.mock.calls.at(-1)![2] as { done_at: string | null }[]
    expect(last.every(s => s.done_at)).toBe(true)
  })
  it('goes back when saving fails', async () => {
    failing = true
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true) })
    expect(h.result.current.views![0].today[0].done_at).toBeNull()
  })
  it('does nothing for a plan with no saved day', async () => {
    views = [{ ...view([]), todayDayId: null }]
    const h = await open()
    await act(async () => { h.result.current.setDone('p1', 'a', true) })
    expect(saveDaySessions).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/sessionRow.test.tsx tests/unit/usePlans.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `components/plan/SessionRow.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { CourseTag } from '@/components/ui/CourseTag'
import type { SessionView } from '@/lib/plan/load'
import type { Course } from '@/lib/types'

export const KIND_LABEL = { warmup: 'Warm-up', learn: 'Learn', revise: 'Revise' } as const

// One planned study session, as a tick-off row like a task
export function SessionRow({ s, course, done, onToggle, onWarmup, warmingUp }: {
  s: SessionView; course?: Course; done: boolean; onToggle: () => void; onWarmup?: () => void; warmingUp?: boolean
}) {
  const label = `${KIND_LABEL[s.kind]}: ${s.topicName}`
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-r-xl border border-l-4 border-line bg-raised py-2 pl-3 pr-2"
      style={{ borderLeftColor: course?.color ?? 'var(--line)' }}>
      <input type="checkbox" checked={done} onChange={onToggle} aria-label={`Mark ${label} done`} className="size-4 shrink-0 accent-[var(--accent-solid)]" />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${done ? 'text-muted line-through' : ''}`}>{label}</div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted"><CourseTag course={course} /><span>{s.minutes} min</span></div>
      </div>
      {s.kind === 'warmup' && s.noteId && onWarmup
        ? <button type="button" className="btn" disabled={warmingUp} onClick={onWarmup}>{warmingUp ? 'Making quiz…' : 'Start warm-up'}</button>
        : <Link className="btn-ghost text-accent" href={s.noteId ? `/notes/${s.noteId}` : '/progress'}>Open</Link>}
    </div>
  )
}
```

Create `components/plan/usePlans.ts`:

```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { loadPlans, type PlanView, type SessionView } from '@/lib/plan/load'
import { saveDaySessions } from '@/lib/plan/service'
import type { StoredSession } from '@/lib/plan/types'

const stored = (s: SessionView): StoredSession => ({ id: s.id, topic_id: s.topic_id, kind: s.kind, minutes: s.minutes, done_at: s.done_at })

// The student's active study plans with today's sessions. Ticking a session saves the day's list straight away.
export function usePlans() {
  const { profile } = useProfile()
  const save = useSaver()
  const tz = profile.timezone
  const [views, setViews] = useState<PlanView[] | null>(null)
  const [version, setVersion] = useState(0)
  const latest = useRef<PlanView[] | null>(null) // the newest list, so two quick ticks both count

  useEffect(() => {
    let live = true
    loadPlans(supabase(), tz, new Date()).then(v => { if (live) { latest.current = v; setViews(v) } }).catch(() => { if (live) { latest.current = []; setViews([]) } })
    return () => { live = false }
  }, [tz, version])

  const reload = useCallback(() => setVersion(v => v + 1), [])

  function setDone(planId: string, sessionId: string, done: boolean) {
    const view = latest.current?.find(v => v.plan.id === planId)
    const before = view?.today.find(s => s.id === sessionId)
    if (!view || !view.todayDayId || !before) return
    const dayId = view.todayDayId
    const set = (stamp: string | null) => {
      const next = (latest.current ?? []).map(v => (v.plan.id === planId ? { ...v, today: v.today.map(s => (s.id === sessionId ? { ...s, done_at: stamp } : s)) } : v))
      latest.current = next; setViews(next)
    }
    const stamp = done ? new Date().toISOString() : null
    save(
      () => set(stamp),
      () => set(before.done_at),
      () => saveDaySessions(supabase(), dayId, (latest.current?.find(v => v.plan.id === planId)?.today ?? []).map(stored)),
    )
  }
  return { views, reload, setDone }
}
```

Create `components/plan/useWarmup.ts`:

```ts
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postAi } from '@/components/ai/aiFetch'

// A Warm-up: a 5-question quiz made from the topic's newest note, then opened
export function useWarmup() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  async function start(s: { id: string; noteId: string | null }) {
    if (!s.noteId) return
    setBusy(s.id); setError(null)
    const r = await postAi<{ id: string }>('/api/ai/quiz', { noteId: s.noteId, count: 5, types: ['mcq', 'true_false', 'short'] })
    setBusy(null)
    if (!r.ok) { setError({ code: r.error, message: r.message }); return }
    router.push(`/quiz/${r.value.id}`)
  }
  return { busy, error, start }
}
```

`app/(app)/home/page.tsx` (read it first; keep CRLF if present): add imports

```tsx
import { AiError } from '@/components/ai/AiError'
import { SessionRow } from '@/components/plan/SessionRow'
import { usePlans } from '@/components/plan/usePlans'
import { useWarmup } from '@/components/plan/useWarmup'
```

in the component add `const plans = usePlans()` and `const warmup = useWarmup()` next to the other hooks, and `const sessions = (plans.views ?? []).flatMap(v => v.today.map(s => ({ v, s })))`. In the Today card, right after `<h2 className="section-label">Today</h2>`, add:

```tsx
          {sessions.map(({ v, s }) => (
            <SessionRow key={s.id} s={s} course={courseOf(v.courseId)} done={!!s.done_at}
              onToggle={() => plans.setDone(v.plan.id, s.id, !s.done_at)} onWarmup={() => { void warmup.start(s) }} warmingUp={warmup.busy === s.id} />
          ))}
          {warmup.error && <AiError code={warmup.error.code} message={warmup.error.message} />}
```

and change the empty message condition from `list.length === 0 &&` to `list.length === 0 && sessions.length === 0 &&`.

- [ ] **Step 4: Run to see them pass, plus the whole unit suite, lint and types**

Run: `npx vitest run tests/unit 2>&1 | tail -6; npx eslint app components lib tests; npx tsc --noEmit`
Expected: PASS, clean. `usePlans` writes a ref inside event handlers and a promise callback only, never during render; if the React Compiler lint objects to `latest.current` reads in `setDone`, keep them (they are in an event handler) and fix only what lint names.

- [ ] **Step 5: Commit**

```bash
git add app components tests
git commit -m "feat: session rows, the plan hook and today's sessions on Home

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Study plan panel in the Planner

**Files:**
- Create: `components/plan/PlanForm.tsx`, `components/plan/StudyPlanPanel.tsx`, `tests/unit/planForm.test.tsx`, `tests/unit/studyPlanPanel.test.tsx`
- Modify: `app/(app)/planner/page.tsx`, `lib/plan/service.ts` (create replaces an ended plan)

**Interfaces:**
- Consumes: Tasks 3 and 4 (`usePlans`, `SessionRow`, `useWarmup`, `PlanView`, `savePlan`, `deletePlan`); `useConfirm`; `Course`, `Task`.
- Produces:
  - `<PlanForm title examLabel initial? saving error onSave(settings: { mode: PlanMode; minutesPerDay: number; daysOff: number[] }) onCancel />` — radios named Sprint, Balanced, Deep dive; a "Minutes a day" number field; a checkbox per weekday; button **Save plan**
  - `<StudyPlanPanel courses tasks />` — a `section` labelled "Study plan"

Behaviour the tests pin: for each active plan: a header line (course, mode, minutes, exam and days to go), today's session rows (or "Nothing planned for today."), "Missed this week: N" when there were any, "N sessions don't fit. Choose Sprint or add minutes." when some don't, the next 7 days as a list, **Full schedule** (toggle) showing every day, **Edit plan**, **Delete plan** (after confirming); a plan whose status is `no_topics` shows "Draft topics for <course> on Progress first." with a link, and `no_days` shows "Your exam is too close for a plan."; each course with an upcoming dated exam and no plan gets a "Make a study plan for <exam>" button (the earliest exam per course); with nothing at all: "Add an exam task to a course to make a study plan."

- [ ] **Step 1: Make creating a plan replace an ended one (service)**

In `lib/plan/service.ts`, change the create branch of `savePlan` so a course whose old plan is hidden (exam done or passed) can get a new one:

```ts
export async function savePlan(sb: SupabaseClient, input: PlanInput, id?: string): Promise<void> {
  if (id) check(await sb.from('study_plans').update({ mode: input.mode, minutes_per_day: input.minutes_per_day, days_off: input.days_off }).eq('id', id))
  else {
    // One plan per course: an old one that has ended is hidden, so it is replaced here
    check(await sb.from('study_plans').delete().eq('course_id', input.course_id))
    check(await sb.from('study_plans').insert(input))
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/planForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanForm } from '@/components/plan/PlanForm'

afterEach(cleanup)
const open = (over: Partial<React.ComponentProps<typeof PlanForm>> = {}) => {
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<PlanForm title="Biology" examLabel="Midterm" saving={false} error={null} onSave={onSave} onCancel={onCancel} {...over} />)
  return { onSave, onCancel }
}

describe('PlanForm', () => {
  it('starts on Balanced, 45 minutes, no days off, and saves those', () => {
    const { onSave } = open()
    expect((screen.getByRole('radio', { name: /Balanced/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Minutes a day') as HTMLInputElement).value).toBe('45')
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(onSave).toHaveBeenCalledWith({ mode: 'balanced', minutesPerDay: 45, daysOff: [] })
  })
  it('describes each mode, and saves the choices', () => {
    const { onSave } = open()
    expect(screen.getByText(/neediest 40%/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Deep dive/ }))
    fireEvent.change(screen.getByLabelText('Minutes a day'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sun' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(onSave).toHaveBeenCalledWith({ mode: 'deep', minutesPerDay: 90, daysOff: [0, 6] })
  })
  it('shows the current settings when editing', () => {
    open({ initial: { mode: 'sprint', minutesPerDay: 30, daysOff: [0] } })
    expect((screen.getByRole('radio', { name: /Sprint/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Minutes a day') as HTMLInputElement).value).toBe('30')
    expect((screen.getByRole('checkbox', { name: 'Sun' }) as HTMLInputElement).checked).toBe(true)
  })
  it('refuses minutes outside 10 to 240 and a week with every day off, saying why', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('Minutes a day'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(screen.getByRole('alert').textContent).toBe('Choose between 10 and 240 minutes.')
    fireEvent.change(screen.getByLabelText('Minutes a day'), { target: { value: '45' } })
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) fireEvent.click(screen.getByRole('checkbox', { name: d }))
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(screen.getByRole('alert').textContent).toBe('Leave at least one day to study.')
    expect(onSave).not.toHaveBeenCalled()
  })
  it('shows a save in progress and an error, and cancels', () => {
    const { onCancel } = open({ saving: true, error: 'Couldn\'t save the plan.' })
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save the plan/)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

Create `tests/unit/studyPlanPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { PlanView } from '@/lib/plan/load'
import type { Course, Task } from '@/lib/types'

const setDone = vi.fn(), reload = vi.fn(), start = vi.fn()
let views: PlanView[] | null
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/components/plan/usePlans', () => ({ usePlans: () => ({ views, reload, setDone }) }))
vi.mock('@/components/plan/useWarmup', () => ({ useWarmup: () => ({ busy: null, error: null, start }) }))
const savePlan = vi.fn(async (..._a: unknown[]) => {}), deletePlan = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/plan/service', () => ({ savePlan: (...a: unknown[]) => savePlan(...a), deletePlan: (...a: unknown[]) => deletePlan(...a) }))
import { StudyPlanPanel } from '@/components/plan/StudyPlanPanel'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

const courses: Course[] = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }, { id: 'c2', name: 'Chemistry', color: '#BA7517' }]
const exam = (over: Partial<Task> = {}): Task => ({ id: 'e1', course_id: 'c1', title: 'Midterm', type: 'exam', due_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), priority: 'normal', done_at: null, created_at: '', ...over })
const view = (over: Partial<PlanView> = {}): PlanView => ({
  plan: { id: 'p1', course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 45, days_off: [], exam: { id: 'e1', title: 'Midterm', due_at: '2026-10-26T00:00:00Z', done_at: null } },
  courseId: 'c1', examDay: '2026-10-26', daysToExam: 14, status: 'ok', todayDayId: 'day1',
  today: [{ id: 's1', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null, topicName: 'Krebs cycle', noteId: 'n1' }, { id: 's2', topic_id: 't2', kind: 'warmup', minutes: 10, done_at: null, topicName: 'Glycolysis', noteId: 'n2' }],
  upcoming: [{ day: '2026-10-13', sessions: [{ topicId: 't2', kind: 'learn', minutes: 25, topicName: 'Glycolysis', noteId: 'n2' }] }],
  schedule: [
    { day: '2026-10-13', sessions: [{ topicId: 't2', kind: 'learn', minutes: 25, topicName: 'Glycolysis', noteId: 'n2' }] },
    { day: '2026-10-25', sessions: [{ topicId: 't1', kind: 'revise', minutes: 15, topicName: 'Krebs cycle', noteId: 'n1' }] },
  ],
  unscheduled: 0, missed: 0, ...over,
})
const open = async (tasks: Task[] = [exam()]) => { await act(async () => { render(<ConfirmProvider><StudyPlanPanel courses={courses} tasks={tasks} /></ConfirmProvider>) }) }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  views = []; setDone.mockClear(); reload.mockClear(); start.mockClear(); savePlan.mockClear(); deletePlan.mockClear()
})
afterEach(cleanup)

describe('Study plan panel', () => {
  it('offers to make a plan for an upcoming exam, and saves it', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Make a study plan for Midterm' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(savePlan).toHaveBeenCalledWith(expect.anything(), { course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 45, days_off: [] })
    expect(reload).toHaveBeenCalled()
  })
  it('only the earliest upcoming exam of a course, and not past, done, undated, or already planned ones', async () => {
    const soon = exam({ id: 'e1', title: 'Soon', due_at: new Date(Date.now() + 5 * 86_400_000).toISOString() })
    const later = exam({ id: 'e2', title: 'Later', due_at: new Date(Date.now() + 20 * 86_400_000).toISOString() })
    const past = exam({ id: 'e3', course_id: 'c2', title: 'Past', due_at: new Date(Date.now() - 86_400_000).toISOString() })
    const undated = exam({ id: 'e4', course_id: 'c2', title: 'Undated', due_at: null })
    const assignment = exam({ id: 'e5', course_id: 'c2', title: 'Essay', type: 'assignment' })
    await open([later, soon, past, undated, assignment])
    expect(screen.getByRole('button', { name: 'Make a study plan for Soon' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Later|Past|Undated|Essay/ })).toBeNull()
    cleanup()
    views = [view()]
    await open([exam()])
    expect(screen.queryByRole('button', { name: /Make a study plan/ })).toBeNull()
  })
  it('says what to do when there is nothing to plan', async () => {
    await open([])
    expect(screen.getByText('Add an exam task to a course to make a study plan.')).toBeTruthy()
  })
  it('shows a plan: its summary, today\'s sessions, the next days, and ticks a session', async () => {
    views = [view()]
    await open()
    const panel = screen.getByRole('region', { name: 'Study plan' })
    expect(panel.textContent).toContain('Biology')
    expect(panel.textContent).toMatch(/Balanced.*45 min a day.*Midterm in 14 days/)
    expect(within(panel).getByText('Learn: Krebs cycle')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Mark Learn: Krebs cycle done' }))
    expect(setDone).toHaveBeenCalledWith('p1', 's1', true)
    expect(within(panel).getByText(/Learn: Glycolysis \(25 min\)/)).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Start warm-up' }))
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ id: 's2', noteId: 'n2' }))
  })
  it('the full schedule shows every day, and hides again', async () => {
    views = [view()]
    await open()
    expect(screen.queryByText(/Revise: Krebs cycle \(15 min\)/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Full schedule' }))
    expect(screen.getByText(/Revise: Krebs cycle \(15 min\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide full schedule' }))
    expect(screen.queryByText(/Revise: Krebs cycle \(15 min\)/)).toBeNull()
  })
  it('says when nothing is planned today, and what was missed or does not fit', async () => {
    views = [view({ today: [], missed: 2, unscheduled: 3 })]
    await open()
    expect(screen.getByText('Nothing planned for today.')).toBeTruthy()
    expect(screen.getByText('Missed this week: 2')).toBeTruthy()
    expect(screen.getByText(/3 sessions don't fit/)).toBeTruthy()
  })
  it('no topics sends the student to Progress; an exam too close says so', async () => {
    views = [view({ status: 'no_topics', today: [], upcoming: [], schedule: [] })]
    await open()
    expect(screen.getByText(/Draft topics for Biology on Progress first/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Progress' }).getAttribute('href')).toBe('/progress')
    cleanup()
    views = [view({ status: 'no_days', today: [], upcoming: [], schedule: [] })]
    await open()
    expect(screen.getByText('Your exam is too close for a plan.')).toBeTruthy()
  })
  it('edits the plan\'s settings, and deletes it after confirming', async () => {
    views = [view()]
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
    fireEvent.click(screen.getByRole('radio', { name: /Sprint/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(savePlan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: 'sprint' }), 'p1')
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }))
    await act(async () => { fireEvent.click(screen.getByRole('dialog').querySelector('button.btn-danger') as HTMLElement) })
    expect(deletePlan).toHaveBeenCalledWith(expect.anything(), 'p1')
    expect(reload).toHaveBeenCalled()
  })
  it('keeps the form open and says so when saving fails', async () => {
    savePlan.mockRejectedValueOnce(new Error('rls'))
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Make a study plan for Midterm' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save the plan/)
  })
})
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run tests/unit/planForm.test.tsx tests/unit/studyPlanPanel.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the form**

Create `components/plan/PlanForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { PlanMode } from '@/lib/plan/types'

export type PlanSettings = { mode: PlanMode; minutesPerDay: number; daysOff: number[] }
const MODES: { value: PlanMode; label: string; blurb: string }[] = [
  { value: 'sprint', label: 'Sprint', blurb: 'The neediest 40% of topics. For a last push.' },
  { value: 'balanced', label: 'Balanced', blurb: 'Most topics (80%), with revision.' },
  { value: 'deep', label: 'Deep dive', blurb: 'Every topic, with extra revision.' },
]
// Monday first; the numbers are weekday numbers where 0 is Sunday
const DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]

export function PlanForm({ title, examLabel, initial, saving, error, onSave, onCancel }: {
  title: string; examLabel: string; initial?: PlanSettings; saving: boolean; error: string | null
  onSave: (s: PlanSettings) => void; onCancel: () => void
}) {
  const [mode, setMode] = useState<PlanMode>(initial?.mode ?? 'balanced')
  const [minutes, setMinutes] = useState(String(initial?.minutesPerDay ?? 45))
  const [off, setOff] = useState<number[]>(initial?.daysOff ?? [])
  const [problem, setProblem] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(minutes)
    if (!Number.isInteger(m) || m < 10 || m > 240) { setProblem('Choose between 10 and 240 minutes.'); return }
    if (off.length >= 7) { setProblem('Leave at least one day to study.'); return }
    setProblem(null)
    onSave({ mode, minutesPerDay: m, daysOff: [...off].sort((a, b) => a - b) })
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line p-3">
      <p className="text-sm font-medium">{title} · {examLabel}</p>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs text-muted">Mode</legend>
        {MODES.map(m => (
          <label key={m.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="mode" className="mt-1 accent-[var(--accent-solid)]" checked={mode === m.value} onChange={() => setMode(m.value)} />
            <span><span className="font-medium">{m.label}</span> <span className="text-muted">{m.blurb}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="field max-w-40"><span>Minutes a day</span>
        <input type="number" min={10} max={240} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} />
      </label>
      <fieldset>
        <legend className="mb-1 text-xs text-muted">Days off</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS.map(([n, label]) => (
            <label key={n} className="flex items-center gap-1 text-sm">
              <input type="checkbox" className="accent-[var(--accent-solid)]" checked={off.includes(n)}
                onChange={e => setOff(o => (e.target.checked ? [...o, n] : o.filter(x => x !== n)))} />{label}
            </label>
          ))}
        </div>
      </fieldset>
      {(problem || error) && <p role="alert" className="text-sm text-danger">{problem ?? error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Implement the panel**

Create `components/plan/StudyPlanPanel.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { AiError } from '@/components/ai/AiError'
import { PlanForm, type PlanSettings } from '@/components/plan/PlanForm'
import { KIND_LABEL, SessionRow } from '@/components/plan/SessionRow'
import { usePlans } from '@/components/plan/usePlans'
import { useWarmup } from '@/components/plan/useWarmup'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { supabase } from '@/lib/supabase/client'
import { deletePlan, savePlan } from '@/lib/plan/service'
import type { PlanView, ScheduledView } from '@/lib/plan/load'
import type { PlanMode } from '@/lib/plan/types'
import type { Course, Task } from '@/lib/types'

const MODE_LABEL: Record<PlanMode, string> = { sprint: 'Sprint', balanced: 'Balanced', deep: 'Deep dive' }
const dayLabel = (day: string) => formatInTimeZone(new Date(`${day}T12:00:00Z`), 'UTC', 'EEE d MMM')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function Days({ days }: { days: { day: string; sessions: ScheduledView[] }[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {days.map(d => (
        <li key={d.day} className="flex gap-2">
          <span className="w-24 shrink-0 text-muted">{dayLabel(d.day)}</span>
          <span>{d.sessions.length ? d.sessions.map(s => `${KIND_LABEL[s.kind]}: ${s.topicName} (${s.minutes} min)`).join(' · ') : <span className="text-muted">Rest</span>}</span>
        </li>
      ))}
    </ul>
  )
}

// Planner: make a study plan from an exam, see today's sessions and the days ahead
export function StudyPlanPanel({ courses, tasks }: { courses: Course[]; tasks: Task[] }) {
  const confirm = useConfirm()
  const plans = usePlans()
  const warmup = useWarmup()
  const [form, setForm] = useState<{ kind: 'new'; exam: Task } | { kind: 'edit'; view: PlanView } | null>(null)
  const [full, setFull] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const courseOf = (id: string) => courses.find(c => c.id === id)

  if (!plans.views) return null
  const views = plans.views
  const planned = new Set(views.map(v => v.courseId))
  const now = Date.now()
  // The earliest upcoming dated exam of each course that has no plan
  const offers = courses.flatMap(c => {
    if (planned.has(c.id)) return []
    const next = tasks.filter(t => t.type === 'exam' && t.course_id === c.id && t.due_at && new Date(t.due_at).getTime() > now && !t.done_at)
      .sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0]
    return next ? [next] : []
  })

  async function save(s: PlanSettings) {
    if (!form) return
    setSaving(true); setError(null)
    try {
      if (form.kind === 'new') await savePlan(supabase(), { course_id: form.exam.course_id!, exam_task_id: form.exam.id, mode: s.mode, minutes_per_day: s.minutesPerDay, days_off: s.daysOff })
      else await savePlan(supabase(), { course_id: form.view.courseId, exam_task_id: form.view.plan.exam_task_id, mode: s.mode, minutes_per_day: s.minutesPerDay, days_off: s.daysOff }, form.view.plan.id)
      setForm(null); plans.reload()
    } catch { setError('Couldn\'t save the plan. Try again.') } finally { setSaving(false) }
  }
  async function remove(v: PlanView) {
    if (!await confirm({ title: 'Delete this study plan?', body: 'Your planned sessions and what you ticked are deleted. Your topics and notes are not touched.', confirmLabel: 'Delete', danger: true })) return
    try { await deletePlan(supabase(), v.plan.id); plans.reload() } catch { setError('Couldn\'t delete the plan. Try again.') }
  }

  const editing = form?.kind === 'edit' ? form.view : null
  return (
    <section aria-label="Study plan" className="card mt-4 space-y-4">
      <h2 className="font-semibold">Study plan</h2>
      {views.length === 0 && offers.length === 0 && <p className="text-sm text-muted">Add an exam task to a course to make a study plan.</p>}

      {views.map(v => {
        const course = courseOf(v.courseId)
        return (
          <div key={v.plan.id} className="space-y-2">
            {editing?.plan.id === v.plan.id ? (
              <PlanForm title={course?.name ?? 'Course'} examLabel={v.plan.exam.title} saving={saving} error={error}
                initial={{ mode: v.plan.mode, minutesPerDay: v.plan.minutes_per_day, daysOff: v.plan.days_off }} onSave={s => { void save(s) }} onCancel={() => { setForm(null); setError(null) }} />
            ) : (
              <>
                <p className="text-sm"><span className="font-medium">{course?.name}</span> <span className="text-muted">· {MODE_LABEL[v.plan.mode]} · {v.plan.minutes_per_day} min a day · {v.plan.exam.title} in {plural(v.daysToExam, 'day')}</span></p>
                {v.status === 'no_topics' && <p className="text-sm text-muted">Draft topics for {course?.name} on Progress first. <Link className="text-accent" href="/progress">Open Progress</Link></p>}
                {v.status === 'no_days' && <p className="text-sm text-muted">Your exam is too close for a plan.</p>}
                {v.status === 'ok' && (
                  <>
                    <div>
                      <h3 className="section-label">Today</h3>
                      {v.today.length === 0 && <p className="text-sm text-muted">Nothing planned for today.</p>}
                      {v.today.map(s => (
                        <SessionRow key={s.id} s={s} course={course} done={!!s.done_at} onToggle={() => plans.setDone(v.plan.id, s.id, !s.done_at)}
                          onWarmup={() => { void warmup.start(s) }} warmingUp={warmup.busy === s.id} />
                      ))}
                    </div>
                    {v.missed > 0 && <p className="text-sm text-muted">Missed this week: {v.missed}</p>}
                    {v.unscheduled > 0 && <p className="text-sm text-muted">{plural(v.unscheduled, 'session')} don&apos;t fit. Choose Sprint or add minutes.</p>}
                    {v.upcoming.length > 0 && <div><h3 className="section-label">Next days</h3><Days days={v.upcoming} /></div>}
                    {full === v.plan.id && <div><h3 className="section-label">Full schedule</h3><Days days={v.schedule} /></div>}
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {v.status === 'ok' && v.schedule.length > 0 && <button type="button" className="btn" onClick={() => setFull(f => (f === v.plan.id ? null : v.plan.id))}>{full === v.plan.id ? 'Hide full schedule' : 'Full schedule'}</button>}
                  <button type="button" className="btn" onClick={() => { setError(null); setForm({ kind: 'edit', view: v }) }}>Edit plan</button>
                  <button type="button" className="btn-ghost text-danger" onClick={() => { void remove(v) }}>Delete plan</button>
                </div>
              </>
            )}
          </div>
        )
      })}

      {offers.map(exam => (
        form?.kind === 'new' && form.exam.id === exam.id
          ? <PlanForm key={exam.id} title={courseOf(exam.course_id!)?.name ?? 'Course'} examLabel={exam.title} saving={saving} error={error} onSave={s => { void save(s) }} onCancel={() => { setForm(null); setError(null) }} />
          : <button key={exam.id} type="button" className="btn" onClick={() => { setError(null); setForm({ kind: 'new', exam }) }}>Make a study plan for {exam.title}</button>
      ))}
      {warmup.error && <AiError code={warmup.error.code} message={warmup.error.message} />}
      {!form && error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  )
}
```

In `app/(app)/planner/page.tsx` (read it first; preserve CRLF if present) import `StudyPlanPanel` and render `<StudyPlanPanel courses={courses} tasks={tasks} />` in the Tasks tab, directly after the `<QuickAdd … />` line and before the "Add your first course" hint.

- [ ] **Step 6: Run to see them pass, plus the whole unit suite, lint and types**

Run: `npx vitest run tests/unit 2>&1 | tail -6; npx eslint app components lib tests; npx tsc --noEmit`
Expected: PASS, clean. If `date-fns-tz` import fails, copy how `app/(app)/home/page.tsx` imports `formatInTimeZone`.

- [ ] **Step 7: Commit**

```bash
git add app components lib tests
git commit -m "feat: the Study plan panel in the Planner

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end, a look at it, and the full checks

**Files:**
- Create: `e2e/studyPlan.spec.ts`

**Interfaces:**
- Consumes: everything above; the fake OpenAI's `topics` answers (from U2a) and canned quiz; the helpers `signUp`, `noteWithText` in `e2e/helpers.ts`.

- [ ] **Step 1: Write the E2E spec**

Create `e2e/studyPlan.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

async function menu(page: Page, name: string, item: string) {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await page.getByRole('menu', { name }).locator('[role^="menuitem"]', { hasText: item }).click()
}
async function inBiology(page: Page) {
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH'),
    page.getByLabel('Course').selectOption({ label: 'Biology' }),
  ])
}
// Two Biology notes, topics drafted and saved, then an exam next week: ready for a plan
async function readyForPlan(page: Page) {
  await signUp(page)
  await noteWithText(page)
  await inBiology(page)
  await menu(page, 'File', 'New note')
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
  await page.getByLabel('Title').fill('Glycolysis notes')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('Glycolysis splits glucose into two pyruvate molecules in the cytoplasm. '.repeat(4))
  await expect(page.getByText('Saved')).toBeVisible()
  await inBiology(page)
  await page.goto('/progress')
  const topics = page.getByRole('region', { name: 'Topics' })
  await topics.getByRole('button', { name: 'Draft topics' }).click()
  await topics.getByRole('button', { name: 'Save topics' }).click()
  await expect(page.getByText('Topics saved.')).toBeVisible()
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Midterm next fri')
  await page.getByLabel('Course').first().selectOption({ label: 'Biology' })
  await page.getByLabel('Type').selectOption('exam')
  await page.getByLabel('Add a task').press('Enter')
  await expect(page.getByText('Midterm')).toBeVisible()
}

test('make a study plan from an exam, see today\'s sessions on Planner and Home, and tick one', async ({ page }) => {
  test.setTimeout(120_000)
  await readyForPlan(page)
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('radio', { name: /Deep dive/ }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Deep dive · 45 min a day · Midterm in/)).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Today' })).toBeVisible()
  const row = panel.getByRole('checkbox', { name: /^Mark (Learn|Warm-up|Revise): .* done$/ }).first()
  await expect(row).toBeVisible()
  await row.check()
  // The same day's list is on Home, with the tick kept
  await page.goto('/home')
  await expect(page.getByRole('checkbox', { name: /^Mark (Learn|Warm-up|Revise): .* done$/ }).first()).toBeChecked()
  // And it stays that way after a reload
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /^Mark (Learn|Warm-up|Revise): .* done$/ }).first()).toBeChecked()
})

test('a Warm-up makes a quiz and opens it', async ({ page }) => {
  test.setTimeout(120_000)
  await readyForPlan(page)
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await panel.getByRole('button', { name: 'Start warm-up' }).first().click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
})

test('edit the plan, then delete it', async ({ page }) => {
  test.setTimeout(120_000)
  await readyForPlan(page)
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Balanced · 45 min a day/)).toBeVisible()
  await panel.getByRole('button', { name: 'Edit plan' }).click()
  await panel.getByRole('radio', { name: /Sprint/ }).click()
  await panel.getByLabel('Minutes a day').fill('30')
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Sprint · 30 min a day/)).toBeVisible()
  await panel.getByRole('button', { name: 'Delete plan' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(panel.getByRole('button', { name: 'Make a study plan for Midterm' })).toBeVisible()
})

test('a course with no topics is sent to Progress first', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Midterm next fri')
  await page.getByLabel('Course').first().selectOption({ label: 'Biology' })
  await page.getByLabel('Type').selectOption('exam')
  await page.getByLabel('Add a task').press('Enter')
  const panel = page.getByRole('region', { name: 'Study plan' })
  await panel.getByRole('button', { name: 'Make a study plan for Midterm' }).click()
  await panel.getByRole('button', { name: 'Save plan' }).click()
  await expect(panel.getByText(/Draft topics for Biology on Progress first/)).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Stop the preview server first if one is running (`preview_list`, then `preview_stop`): only one `next dev` per folder.
Run: `npx playwright test e2e/studyPlan.spec.ts`
Expected: all four PASS on desktop and mobile (8 results). If the exam is not created (the Planner QuickAdd flow differs), read `components/planner/QuickAdd.tsx` and fix the test's steps, not the app. If "Midterm next fri" lands on today (it is a Friday), "next fri" is still the following week's Friday, so it stays in the future.

- [ ] **Step 3: Look at it**

Temporarily add `await page.screenshot({ path: `test-results/plan-${test.info().project.name}.png`, fullPage: true })` at the end of the first test (after the reload checks), then switch to Paper and take `plan-paper-…png` the same way (`/settings`, the "Paper look" radio, back to `/planner`). Run it on both projects and open the images with the Read tool. Check: session rows read like task rows, the panel is clear, nothing clips on the phone, Paper stays readable. Remove the temporary lines and delete the PNGs; fix any real problem and say what you changed.

- [ ] **Step 4: Run everything**

Run: `npm test 2>&1 | tail -6; npm run test:db 2>&1 | tail -6; npx eslint; npx tsc --noEmit; npx next build 2>&1 | tail -6`
Then: `npx playwright test > /tmp/e2e-all.log 2>&1; grep -E "passed|failed|^\s+x " /tmp/e2e-all.log`
Expected: unit and DB suites pass; lint, types and build clean; E2E passes (an older spec that fails only in the full run and passes alone is dev-server load: rerun it alone and note it).

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: end-to-end checks for the study plan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
After this commit, use superpowers:finishing-a-development-branch. The migration needs `npx supabase db push` by the user before the study plan works on the deployed app.

---

## Self-review (done while writing)

- **Spec coverage:** tables, RLS, one plan per course, exam must be an exam task in the course, days kept once per plan and day, cascades (T1); the scheduler with modes, need order, Warm-up rule, no repeated Learn, spacing, reserved days, minutes smaller than a session, unscheduled, days off, exam today or past, no topics (T2); history, snapshots, newest note, missed count, hiding ended plans, deleted topics, exam tomorrow (T3); ticking and unticking, Home rows, Warm-up quiz, Open links (T4); the panel with form, validation, edit, delete, full schedule, messages, earliest exam per course, replacing an ended plan (T5); E2E and visual check (T6). Spec §6 "exam moved": the loader reads the exam's current date each time (T3).
- **Types:** `PlanMode`, `SessionKind`, `PlanTopic`, `PlanSession`, `DayPlan`, `StoredSession` (T2) are used by T3 to T5 under the same names; `PlanView`, `SessionView`, `ScheduledView` (T3) by T4 and T5; `PlanSettings` (T5) is only used by the form and panel.
- **Placeholders:** none. Two steps say to read an existing file and keep its line endings or import style, because only the existing text is authoritative.
- **Risks to watch:** the scheduler tests encode first-fit placement exactly (read failures against the spec before changing either side); `loadPlans` makes several requests per plan (fine for the handful of plans a student has); the E2E exam creation depends on the Planner quick-add form.
