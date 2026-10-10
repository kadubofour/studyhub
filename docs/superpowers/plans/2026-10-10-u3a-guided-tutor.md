# U3a Guided Mode for the Tutor: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tutor chat can be switched into guided mode (remembered per chat): the tutor asks first, hints in steps, answers on request, and two buttons ("Give me a hint", "Show the answer") make asking easy.

**Architecture:** One boolean column on `tutor_chats`; `tutorInstructions` gets a guided block; the tutor route passes the chat's setting; the chat header gets a switch and the composer area gets two quick-reply buttons.

**Tech Stack:** Next.js 16 (docs in `node_modules/next/dist/docs/`), React 19, Supabase, Vitest (unit + DB), Playwright with the fake OpenAI.

**Spec:** `docs/superpowers/specs/2026-10-10-u3a-guided-tutor-design.md`

## Global Constraints

- New chats and old chats are not guided; a non-guided chat's instructions and screen are exactly as today.
- The quick-reply buttons show only when `chat.guided` and the chat has at least one message; they send "Give me a hint." / "Show me the answer." as ordinary tutor messages and never touch the typed draft.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; git identity is kadubofour's noreply, never the Gmail.
- Never handle API keys or secrets. Do not push or merge to `main` without asking (main deploys).
- Windows project: edit files with a Python script file or the Edit tool (no `sed -i` on CRLF files; no shell heredocs containing apostrophes in Python strings); keep line endings.
- Each task ends with its tests green, `npx eslint` and `npx tsc --noEmit` clean, and a commit.

## Review Focus

- The guided block must not stop notes, flashcards, quizzes or tasks being made when asked (Task 1 instruction test).
- The switch must roll back on a failed save and never leave the screen and database disagreeing (Task 2).
- The buttons must not clear a half-typed message and must not fire while a reply is being written (Task 2).

---

### Task 1: Data, instructions and the route

**Files:**
- Create: `supabase/migrations/20261018000000_tutor_guided.sql`
- Modify: `lib/data/tutor.ts`, `lib/ai/tutorContext.ts`, `app/api/ai/tutor/route.ts`, `tests/db/tutor.test.ts`, `tests/unit/tutorContext.test.ts`, `tests/unit/aiTutorRoute.test.ts`, `tests/unit/tutorData.test.ts`

**Interfaces:**
- Produces: `tutor_chats.guided boolean not null default false`; `TutorChat.guided: boolean`; `setChatGuided(sb, id, guided): Promise<void>`; `tutorInstructions(hasNote: boolean, guided?: boolean): string`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/tutor.test.ts` (top-level, after the last `describe`):

```ts
describe('guided chats', () => {
  it('start off, can be switched by their owner, and not by anyone else', async () => {
    const u = await newUser(), other = await newUser()
    const { data: c } = await chat(u)
    expect((await u.sb.from('tutor_chats').select('guided').eq('id', c!.id).single()).data).toEqual({ guided: false })
    expect((await u.sb.from('tutor_chats').update({ guided: true }).eq('id', c!.id)).error).toBeNull()
    expect((await u.sb.from('tutor_chats').select('guided').eq('id', c!.id).single()).data).toEqual({ guided: true })
    await other.sb.from('tutor_chats').update({ guided: false }).eq('id', c!.id)
    expect((await u.sb.from('tutor_chats').select('guided').eq('id', c!.id).single()).data).toEqual({ guided: true })
  })
})
```

Append to `tests/unit/tutorContext.test.ts`:

```ts
describe('guided mode instructions', () => {
  it('asks first, hints one at a time, checks answers, gives the answer on request, and still makes things when asked', () => {
    const t = tutorInstructions(true, true)
    expect(t).toMatch(/guided/i)
    expect(t).toMatch(/what they think|what they have tried/i)
    expect(t).toMatch(/do not give the answer in the first reply/i)
    expect(t).toMatch(/one hint at a time/i)
    expect(t).toMatch(/say exactly what is right, what is wrong/i)
    expect(t).toMatch(/ask to see the answer.*in full.*never refuse/i)
    expect(t).toMatch(/summarise in two or three lines/i)
    expect(t).toMatch(/note, flashcards, a quiz or a task are done as normal/i)
  })
  it('a chat that is not guided gets exactly the instructions it always did', () => {
    expect(tutorInstructions(true, false)).toBe(tutorInstructions(true))
    expect(tutorInstructions(true)).not.toMatch(/guided/i)
    expect(tutorInstructions(false)).not.toMatch(/one hint at a time/i)
  })
})
```

In `tests/unit/aiTutorRoute.test.ts` append inside the main `describe`:

```ts
  const instructions = () => (modelInput.mock.calls[0][0] as { instructions: string }).instructions
  it('gives a guided chat the guided instructions, and any other chat the normal ones', async () => {
    chat = { ...chat, guided: true }
    await (await call()).text()
    expect(instructions()).toMatch(/one hint at a time/i)
    modelInput.mockClear()
    chat = { ...chat, guided: false }
    await (await call()).text()
    expect(instructions()).not.toMatch(/one hint at a time/i)
  })
```

Append to `tests/unit/tutorData.test.ts` (import `setChatGuided` with the others) inside its `describe`:

```ts
  it('switches guided mode on a chat', async () => {
    const { b, calls } = q({ error: null })
    await setChatGuided(sbOf(b), 'c1', true)
    expect(calls).toContainEqual(['update', [{ guided: true }]])
    expect(calls).toContainEqual(['eq', ['id', 'c1']])
  })
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/tutorContext.test.ts tests/unit/aiTutorRoute.test.ts tests/unit/tutorData.test.ts` and `npx vitest run tests/db/tutor.test.ts --mode test -t guided`
Expected: FAIL (no guided block; `setChatGuided` missing; column missing).

- [ ] **Step 3: Implement**

Create `supabase/migrations/20261018000000_tutor_guided.sql`:

```sql
-- Guided mode: the tutor asks first and gives hints in steps. Per chat, off by default.
alter table public.tutor_chats add column guided boolean not null default false;
```

`lib/data/tutor.ts`: add `guided: boolean` to `TutorChat`, `,guided` to the `CHAT` columns string, and

```ts
export async function setChatGuided(sb: SupabaseClient, id: string, guided: boolean): Promise<void> {
  check(await sb.from('tutor_chats').update({ guided }).eq('id', id))
}
```

`lib/ai/tutorContext.ts`: change the signature to `export function tutorInstructions(hasNote: boolean, guided = false): string` and put the existing template string in a constant `base`, returning `guided ? base + GUIDED : base` where

```ts
const GUIDED = `
- This chat is in guided mode. Teach by asking, not telling. Ask the student what they think, or what they have tried, before explaining. For a problem or a question that checks understanding, do not give the answer in the first reply.
- Give one hint at a time, the smallest that moves them forward. When they answer, say exactly what is right, what is wrong, and why.
- If they say they do not know, or ask for a hint, give the next hint. If they ask to see the answer, give it in full with the explanation: never refuse.
- When they reach the answer, summarise in two or three lines and offer one short follow-up question.
- Requests to make a note, flashcards, a quiz or a task are done as normal, not turned into questions.`
```

(the base text must end with the existing last bullet "- Keep replies as short as the question allows." so the guided block follows it).

`app/api/ai/tutor/route.ts`: select `guided` with the chat (`'id,title,course_id,note_id,lecture_id,guided'`) and pass `tutorInstructions(!!chat.note_id, !!chat.guided)`.

- [ ] **Step 4: Apply the migration; run tests, lint, types**

Run: `export PATH="$PATH:/c/Users/Fii/AppData/Local/Programs/DockerDesktop/resources/bin" && npx supabase migration up && npx vitest run tests/unit 2>&1 | tail -5 && npx vitest run tests/db/tutor.test.ts --mode test && npx eslint app lib tests && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add supabase app lib tests
git commit -m "feat: guided mode for the tutor — setting, instructions and route

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The switch and the quick buttons

**Files:**
- Modify: `components/tutor/ChatView.tsx`, `tests/unit/tutorChat.test.tsx`

**Interfaces:**
- Consumes: `setChatGuided`, `Switch` (`components/ui/Switch.tsx`: `{ checked, onChange, labelledBy, describedBy? }`), `useToast`.
- Produces: a switch named "Guided"; buttons "Give me a hint" and "Show the answer".

- [ ] **Step 1: Write the failing tests**

In `tests/unit/tutorChat.test.tsx`: make the mocked chat guided-aware and mockable. Change the `chat` constant to include `guided: false`, add `let guided = false` and `const setChatGuided = vi.fn(async (..._a: unknown[]) => {})` (with `let guidedFails = false`), change the mock to `getChat: async () => ({ ...chat, guided })`, add `setChatGuided: (...a: unknown[]) => (guidedFails ? Promise.reject(new Error('offline')) : setChatGuided(...a))`, and reset `guided = false; guidedFails = false; setChatGuided.mockClear()` in `beforeEach`. Then append inside the `describe('ChatView', …)`:

```ts
  it('shows the Guided switch off for a normal chat, and turning it on saves it', async () => {
    await open()
    const sw = screen.getByRole('switch', { name: 'Guided' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await act(async () => { fireEvent.click(sw) })
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true')
    expect(setChatGuided).toHaveBeenCalledWith(expect.anything(), 'c1', true)
  })
  it('goes back and says so when guided mode cannot be saved', async () => {
    guidedFails = true
    await open()
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Guided' })) })
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Couldn\'t change guided mode.')).toBeTruthy()
  })
  it('a guided chat starts with the switch on', async () => {
    guided = true
    await open()
    expect(screen.getByRole('switch', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true')
  })
  it('the hint and answer buttons show only in a guided chat that has messages', async () => {
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    await open()
    expect(screen.queryByRole('button', { name: 'Give me a hint' })).toBeNull() // not guided
    cleanup()
    guided = true; messages = []
    await open()
    expect(screen.queryByRole('button', { name: 'Give me a hint' })).toBeNull() // no messages yet
    cleanup()
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    await open()
    expect(screen.getByRole('button', { name: 'Give me a hint' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show the answer' })).toBeTruthy()
  })
  it('the buttons send their message at once and leave a half-typed one alone', async () => {
    guided = true
    messages = [{ id: 'm1', role: 'user', content: 'Why?', sources: [], proposals: [], status: 'ok' }]
    send = vi.fn(async () => ({ ok: true, lines: lines([{ t: 'done', proposals: [] }]) })) as never
    await open()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'my half-typed question' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Give me a hint' })) })
    expect(send).toHaveBeenCalledWith('c1', 'Give me a hint.')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Show the answer' })) })
    expect(send).toHaveBeenCalledWith('c1', 'Show me the answer.')
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('my half-typed question')
  })
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/tutorChat.test.tsx`
Expected: FAIL — no switch named "Guided".

- [ ] **Step 3: Implement**

In `components/tutor/ChatView.tsx` (keep its line endings):

- imports: add `import { Switch } from '@/components/ui/Switch'` and `setChatGuided` to the `@/lib/data/tutor` import.
- `send` takes an optional message: `async function send(override?: string) { const message = (override ?? text).trim(); if (!message || live !== null) return; setProblem(null); if (override === undefined) setText(''); setLive('')` (replace the first lines of the function; the rest is unchanged). Callers `void send()` stay as they are.
- add next to `rename`:

```ts
  async function toggleGuided(on: boolean) {
    setChat(c => c && { ...c, guided: on })
    try { await setChatGuided(supabase(), chatId, on) }
    catch { setChat(c => c && { ...c, guided: !on }); toast('Couldn\'t change guided mode.') }
  }
```
- header: between the course `select` and the Rename button add

```tsx
        <span className="flex items-center gap-2 text-sm">
          <span id="guided-label">Guided</span>
          <Switch checked={chat.guided} onChange={v => { void toggleGuided(v) }} labelledBy="guided-label" describedBy="guided-hint" />
          <span id="guided-hint" className="sr-only">The tutor asks you to try first and gives hints one step at a time.</span>
        </span>
```
- directly above the `<form className="sticky bottom-0 …">` add

```tsx
      {chat.guided && messages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={live !== null} onClick={() => { void send('Give me a hint.') }}>Give me a hint</button>
          <button type="button" className="btn" disabled={live !== null} onClick={() => { void send('Show me the answer.') }}>Show the answer</button>
        </div>
      )}
```

- [ ] **Step 4: Run to see them pass, plus the whole unit suite, lint and types**

Run: `npx vitest run tests/unit 2>&1 | tail -5; npx eslint app components lib tests; npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add components tests
git commit -m "feat: the Guided switch and the hint and answer buttons

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: End-to-end, a look at it, and the full checks

**Files:**
- Create: `e2e/tutorGuided.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```ts
import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

async function askFromNote(page: import('@playwright/test').Page) {
  await signUp(page)
  await noteWithText(page)
  await page.getByRole('button', { name: 'Ask the tutor' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
}

test('guided mode is remembered, and its buttons appear only once the chat has begun', async ({ page }) => {
  await askFromNote(page)
  const guided = page.getByRole('switch', { name: 'Guided' })
  await expect(guided).toHaveAttribute('aria-checked', 'false')
  await Promise.all([page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'), guided.click()])
  await expect(guided).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0) // nothing said yet
  await page.getByLabel('Message').fill('Where does the Krebs cycle happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Guided' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Show the answer' })).toBeVisible()
})

test('Give me a hint sends the request and gets a reply; turning guided off removes the buttons', async ({ page }) => {
  await askFromNote(page)
  const guided = page.getByRole('switch', { name: 'Guided' })
  await Promise.all([page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'), guided.click()])
  await page.getByLabel('Message').fill('Where does it happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
  await page.getByLabel('Message').fill('half typed')
  await page.getByRole('button', { name: 'Give me a hint' }).click()
  await expect(page.getByText('Give me a hint.')).toBeVisible()
  await expect(page.getByLabel('Message')).toHaveValue('half typed')
  await expect(page.getByText('mitochondrial matrix')).toHaveCount(2) // a second reply arrived
  await Promise.all([page.waitForResponse(r => r.url().includes('/rest/v1/tutor_chats') && r.request().method() === 'PATCH'), guided.click()])
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0)
})
```

- [ ] **Step 2: Run it**

Stop the preview server first if one is running (`preview_list`, then `preview_stop`).
Run: `npx playwright test e2e/tutorGuided.spec.ts`
Expected: both PASS on desktop and mobile. (The fake reply always contains "mitochondrial matrix"; if the count assertion is flaky because the first reply text is also matched inside the user's message, assert on the number of `.prose-note` blocks instead.)

- [ ] **Step 3: Look at it**

Temporarily add a `page.screenshot` of the guided chat (switch on, a message sent, buttons visible) for Classic and then Paper (`/settings`, "Paper look"), on both projects; open the images with the Read tool; check the switch and buttons are clear and nothing clips on the phone; remove the temporary lines and delete the PNGs.

- [ ] **Step 4: Run everything**

Run: `npm test 2>&1 | tail -6; npm run test:db 2>&1 | tail -6; npx eslint; npx tsc --noEmit; npx next build 2>&1 | tail -6`, then `npx playwright test > /tmp/e2e-all.log 2>&1; grep -E "passed|failed|^\s+x " /tmp/e2e-all.log`.
Expected: all pass and clean (the older mobile "refreshing mid-quiz resumes" spec has failed under full-suite load before: if it is the only failure, rerun it alone and note it).

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: end-to-end checks for guided tutor mode

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
After this commit, use superpowers:finishing-a-development-branch. The migration needs `npx supabase db push` by the user before guided mode works on the deployed app.
