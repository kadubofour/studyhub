# Notebooks: their course's colour, and a page of their own

The student asked for two things. A notebook should be the colour of the course it belongs to, or the accent colour when it belongs to none. Opening a notebook should go to a page of its own instead of filtering the list in place.

## Colour

- **A notebook's course**, in order:
  - the course chosen for it, if one was;
  - otherwise, the course its notes share, when every note in it that has a course has the same one;
  - otherwise none.
- **The cover colour** is that course's colour. With no course it is the student's accent (`var(--accent-solid)`).
- The same rule gives the swatch shown beside a note's notebook name.
- The id-hashed colours go.

## Choosing the course

- The **New notebook** and **Rename notebook** dialogs gain a **Course** select. It lists "No course" and then the student's courses.
- New notebook starts on the course the page is filtered to, if there is one.
- Changing a course's colour changes its notebooks' colour. Deleting a course leaves its notebooks with no course (`on delete set null`).

## The notebook page: `/notebooks/[id]`

It is an ordinary page with the sidebar and top bar, and Notes is marked as the current place.
- **Back:** a link "Notes" at the top.
- **Header:**
  - a large cover;
  - the name (h1);
  - its course tag and "n notes";
  - actions: **New note** (made in this notebook, and in its course if it has one), **Rename** (name and course), and **Delete notebook** (asks first, and keeps the notes, which become unfiled, then goes back to Notes).
- **Its notes**, in the Notes page's layouts and sorts (grid, list or icons, through the same view choice), with a search, each opening the note.
- **Empty:** "No notes in this notebook yet", with New note.
- **Not found** (deleted, or not the student's): "Notebook not found" and a link to Notes.

## Where notebooks are shown

- **Notes page:** the shelf shows each notebook as a cover that links to its page, followed by a **New notebook** tile. The list below shows all the notes. The All/Unfiled choice and the rename and delete controls move off this page; renaming and deleting are on the notebook's page.
- **Library:** while browsing, notebooks are covers that link to their pages, and filed notes stay inside them. The in-place folder, its breadcrumb, its rename and delete controls and `?notebook=` all go. Search and the kind chips still find notes wherever they are, and a note found that way names its notebook.

## Data

Migration `20261107000000_notebook_course.sql`:

```sql
alter table public.notebooks add column course_id uuid references public.courses on delete set null;
-- a notebook can only belong to the student's own course
```

The notebooks policy's check gains `public.owns_course(course_id)`.
