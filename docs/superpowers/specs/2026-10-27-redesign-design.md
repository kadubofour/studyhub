# Studyhub redesign: design

## Understanding

- **Said:** "make the other items have the same design as the flashcards, and redesign the whole project to not look so generic and fix how compact some pages look".
- **Subject:** a study app for university students: notes, flashcard decks, lectures, a planner, a tutor. The things on a student's desk are the vernacular: index cards, ruled paper, a stack of handouts, a recorder.
- **Found:**
  - The app is the stock card kit: every block is the same rounded card with the same soft shadow.
  - Section labels are tracked all-caps eyebrows ("TODAY", "THIS WEEK", "FOCUS").
  - The Home hero is a two-colour gradient.
  - Body text is 14 px and pages pack blocks with 12 px gaps, so Home, Planner and Progress feel cramped.
  - The one tile students like is the deck tile: stacked cards in the course colour and a big number.
- **Constraints:** the four looks (Classic, Paper, Vivid, Playful), light and dark, the student's accent and font all keep working; contrast stays at AA.

## Design plan

**Idea:** a student's desk, not a dashboard. Each kind of thing is drawn as its object: decks as stacked index cards, notes as stacked ruled sheets, lectures as a recording strip. The type does the rest of the work.

- **Type:**
  - Headings, page titles, section titles, tile titles and big numbers use **Bricolage Grotesque**, a characterful grotesk with optical sizes. It is set tight and large for page titles, so the title itself carries each page.
  - Body text stays in the font the student picked, at 15 px with a 1.55 line height.
  - If the student picked a font other than the default Sans, their font is used for headings too: their choice wins.
- **Labels:** no all-caps eyebrows. A section title is a short sentence-case heading in the display face, in the text colour.
- **Hero:** the accent colour with faint ruled lines and a margin line, like the top of a notebook page, instead of a gradient. Playful keeps its flat hero.
- **Hierarchy instead of one card everywhere:**
  - The page title is large.
  - Section titles are medium.
  - Cards get more room inside (20 px), and the space between blocks grows from 12 px to 16–20 px.
- **Items:** notes and lectures get the deck tile's shape:
  - **Note:** a stack of ruled sheets in the course colour. The big text is the day it was last edited ("14 Oct"), and the notebook sits at the right.
  - **Lecture:** a recording strip of bars in the course colour. The big text is the length ("1:02:03"), and the transcript status sits at the right.
  - **Deck:** exactly as before.
- **Roomier pages:** Home, Planner and Progress get more space between and inside blocks, larger headings and readable list rows.

## Reviewed against the defaults

- **Cut:** gradient washes (the hero), all-caps eyebrows, the same card everywhere at one size, and middle-dot meta strings in the new tiles.
- **Considered and rejected:**
  - A cream page with a serif display: Paper already is that, and it is a common default.
  - Monospace data labels: the app keeps mono only for the timer.
- **What makes it this app:** the desk objects drawn on the tiles, and the ruled-page hero. Everything around them stays quiet.

## Parts

`app/layout.tsx` (display font), `app/globals.css` (type scale, section titles, hero, spacing in each look), `components/shell/AppShell.tsx` (display font switch), `components/ui/PageHeader.tsx`, a `StackTile` for the grid tile of decks, notes and lectures (`components/ui/ItemTile.tsx`), Home, Planner and Progress spacing, `components/ui/EmptyState.tsx`.

## Not in this round

New looks, new accents, the note editor and the Focus page (already designed on their own), the public pages.
