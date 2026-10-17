# Flashcard typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native).

**Goal:** answer flashcards by typing, with a forgiving local check and a suggested rating.
**Architecture:** pure `checkAnswer` + remembered mode, a small answer component, wired into the Review page.
**Spec:** `docs/superpowers/specs/2026-10-24-flashcard-typing-design.md`

## Global Constraints
- Existing flip flow and keys unchanged in Flip mode. No dashes as punctuation in copy. React Compiler lint clean.

## Review Focus
- Answers with LaTeX or markdown (`$x^2$`, `**bold**`), numbers, accents, and an empty answer.
- Typing digits 1 to 4 or Space in the box must never rate or reveal.
- A stale rating (double Enter) must not rate twice.

### Task 1: `lib/ui/answerCheck.ts` + `lib/ui/reviewMode.ts` with tests (TDD)
### Task 2: Review page and `TypedAnswer` with tests, e2e (TDD)
