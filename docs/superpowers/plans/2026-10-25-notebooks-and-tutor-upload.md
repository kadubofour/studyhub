# Notebooks and Tutor upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native).

**Goal:** group notes into notebooks; upload from the Tutor and chat about the result.
**Architecture:** one migration, a small data module, pure helpers, two small components wired into the notes page; the existing upload event gains an option.
**Spec:** `docs/superpowers/specs/2026-10-25-notebooks-and-tutor-upload-design.md`

## Global Constraints
- Do not change what existing notes, search or export return except to add `notebook_id`. No dashes as punctuation in copy. React Compiler lint clean.

## Review Focus
- A note cannot be put in another student's notebook (RLS, direct insert and update).
- Deleting a notebook keeps its notes. Searching while a notebook is chosen still filters.
- Moving several selected notes at once; a failed move leaves the list as it was.
- Upload from the Tutor: cancel leaves nothing created; the chat is about the new note.

### Task 1: migration, data layer, helpers, DB tests (TDD)
### Task 2: notebook UI on the notes page (TDD)
### Task 3: Tutor upload (TDD)
