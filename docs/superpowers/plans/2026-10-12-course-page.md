# Course page Implementation Plan

> **For agentic workers:** native execution, TDD per task.

**Goal:** A `/courses/[id]` page that gathers one course's material, topics, exam and quick actions.
**Architecture:** Pure helpers in `lib/course`, a loader in `lib/data/coursePage.ts` reusing `loadLibrary`, `listTopicStats`; a client page.
**Tech Stack:** Next.js 16 App Router, React 19, Supabase, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-12-course-page-design.md

## Global Constraints
No migration. Follow React Compiler lint rules. Page text uses plain words (no jargon).

## Review Focus
- Unknown or malformed course id shows not-found, not a crash.
- Double tap on Revise / Ask tutor makes one chat.
- A course with items but no topics, and one with topics but no items.
- Deleted-then-reopened course; items load failure keeps header.

### Task 1: Pure logic + deck due
Files: `lib/course/summary.ts`, `lib/library/items.ts` (`due?`), `lib/data/library.ts`; test `tests/unit/courseSummary.test.ts`.
- [ ] failing tests for courseSections, summaryLine, cardsDue, examLine; run RED
- [ ] implement; GREEN; commit

### Task 2: Loader
Files: `lib/data/coursePage.ts`; test `tests/unit/coursePageData.test.ts`.
- [ ] failing test (filters items to the course, returns next future exam, null course when missing); RED; implement; GREEN; commit

### Task 3: Page
Files: `app/(app)/courses/[id]/page.tsx`; test `tests/unit/coursePage.test.tsx`.
- [ ] failing tests for states and actions; RED; implement; GREEN; commit

### Task 4: Navigation
Files: middleware `APP_PATHS`, `app/robots.ts`, `TopBar` PAGES, Library link, Progress heading link; tests updated.

### Task 5: E2E + a11y + review
Files: `e2e/course-page.spec.ts`, `e2e/a11y.spec.ts`.
