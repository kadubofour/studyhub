# Tutor chat upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native). Steps use checkbox syntax.

**Goal:** make the conversation view calmer to read and easier to write in.

**Architecture:** pure helpers in `lib/tutor/conversation.ts` (tested alone), wired into `components/tutor/ChatView.tsx` (tested with the existing mocks in `tests/unit/tutorChatActions.test.tsx`). No data or server change.

**Spec:** `docs/superpowers/specs/2026-10-23-tutor-chat-upgrade-design.md`

## Global Constraints

- Keep every existing accessible name (`Copy reply`, `Regenerate reply`, `Send`, `Stop`, `Message`, `Try again`, `Follow-up questions`); new ones: `Copy question`, `Copy chat`, `Jump to latest`, group `Ideas to start with`.
- React Compiler lint: no `Date.now()` or ref reads while rendering; the clock and the window are read in handlers/effects.
- Free-text copy: plain words, no dashes as punctuation.

## Review Focus

- A reply streaming while the student is scrolled up must not move the page.
- Enter on a touch device must never send; with a mouse it sends, Shift+Enter does not.
- A message with no time yet (just sent) shows no time and no day heading.
- Copying the chat when the clipboard is refused says so.
- The empty chat's ideas never send anything.

### Task 1: pure helpers
**Files:** Create `lib/tutor/conversation.ts`, `tests/unit/tutorConversation.test.ts`
- [ ] Write tests: `nearBottom`, `dayHeading` (Today/Yesterday/date, local days), `timeOf` ('' for empty/invalid), `transcript` (title, You/Tutor, skips pending, marks cut-off).
- [ ] Run, see them fail; implement; run, pass.
- [ ] Commit.

### Task 2: the view
**Files:** Modify `components/tutor/ChatView.tsx`; add tests to `tests/unit/tutorChatActions.test.tsx`; e2e in `e2e/tutorUpgrade.spec.ts`.
- [ ] Tests (fail first): ideas in an empty chat fill the box, send nothing, use the note's title; times and day headings; Copy question; Copy chat (and refusal); Enter on touch does not send, with a mouse sends, Shift+Enter does not; count near the limit; Latest button when scrolled up and a reply streams without scrolling the page, and tapping it scrolls.
- [ ] Implement; run unit, lint, tsc, e2e tutor specs.
- [ ] Commit.
