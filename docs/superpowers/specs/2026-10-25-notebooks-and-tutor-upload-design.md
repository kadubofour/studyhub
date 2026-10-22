# Notebooks, and upload from the Tutor: design

## Understanding

- **Said:** "notes should be able to be grouped into notebooks and there should be an upload button in the tutor search".
- **Found:** notes are one flat list, filtered only by course. Upload is a dialog any page can open (`requestUpload`), which ends by opening the new note. The Tutor's search box (on the Tutor page, and inside the "Chat about…" picker) has no way to bring material in.
- **Assumed (recommended options):** a notebook is a named folder a note can be in (one at a time), independent of courses (a notebook can hold notes from several courses); deleting a notebook keeps its notes, which become unfiled; the Tutor's Upload button reuses the existing upload dialog and, when it finishes, starts a chat about the new note.

## Notebooks

| Part | Behaviour |
|---|---|
| Data | New table `notebooks` (id, user, name 1 to 80 characters). `notes.notebook_id` (optional, set null when the notebook is deleted). Row-level security: a student only sees their notebooks and can only put a note in their own notebook. `search_notes` also returns `notebook_id`. Included in the account export. |
| Notes page | A row of notebook chips above the notes: All, each notebook with its note count, Unfiled, and "+ Notebook". Choosing one shows only its notes. With a notebook chosen, the Note button makes a note inside it, and Rename and Delete notebook are offered. |
| Moving notes | "Move to notebook…" in a note's menu and for the notes selected in Select mode: a small dialog listing the notebooks, "No notebook", and "New notebook". |
| Tiles | A note in a notebook shows the notebook's name when viewing All. |
| Deleting | Deleting a notebook asks first, says its notes are kept, and puts them in Unfiled. |

## Upload from the Tutor

| Part | Behaviour |
|---|---|
| Tutor page | An Upload button beside the chat search (shown even with no chats yet). |
| "Chat about…" picker | An Upload button beside its search; it closes the picker and opens the same dialog. |
| After the upload | The upload dialog's "After saving" gains "Chat about it with the tutor"; opened from the Tutor it is already chosen. Saving creates the note and a chat about it, and opens the chat. |

## Parts

`supabase/migrations/20261103000000_notebooks.sql`, `lib/data/notebooks.ts`, `lib/notes/notebooks.ts` (pure: filter and counts), `components/notes/NotebookBar.tsx`, `components/notes/MoveToNotebookDialog.tsx`, `NotesSidebar`, `lib/scan/events.ts` (`requestUpload({ next })`), `UploadDialog`, Tutor page, `TutorPickDialog`.

## Not in this round

Nested notebooks, notebook colours or covers, exporting a whole notebook in one step (select all, then export, works already), moving a note from inside the editor.
