# Studyhub redesign, second pass: design

## Understanding

- **Said:** "redesign again, and again looks too compact, like it shouldnt look generic at all improve it in every way you can from the buttons to the cards, take out anything unnecessary or redundant".
- **Found after the first pass:**
  - Text and controls are still small: 15 px body, 30 px buttons, 13 px labels.
  - Every block is a bordered white card with a shadow.
  - Home repeats itself:
    - The top bar has the timer and the cards due, and Home shows both again.
    - Four shortcut tiles copy the sidebar (Quiz, Lectures, Tutor, Upload).
    - "Your courses" copies the sidebar's course list.
    - "Tasks today" is a stat and then the Today list.
  - The top bar repeats the page name in small type while the page's own title is hidden.

## Design system

- **Scale:**
  - Body text is 16 px with a 1.6 line height.
  - Section titles are 20 px and page titles 40 px, in the display face.
  - Space between page sections is 32 px.
- **One title per page:** the big page title is always shown. The top bar no longer carries the page name; it is a slim strip of status (the running timer, cards due, level).
- **Buttons** are 40 px high (44 px on touch), with 15 px medium text and 12 px corners:
  - Primary: the accent, solid.
  - Secondary: a filled soft surface, no outline.
  - Quiet: text only, with a soft background on hover.
- **Inputs** are 44 px high: a soft filled field that takes the accent outline on focus.
- **Cards:**
  - Flat panels with 20 px corners, 24 px inside and a hairline edge.
  - No shadow at rest; a clickable tile lifts with a shadow on hover.
  - Vivid and Playful keep their own character.
- **Sidebar:**
  - 248 px wide, with 15 px items that have room.
  - Upload and Scan become ordinary items in an "Add" group, instead of two heavy dark pills.
- **Looks:** Classic and Paper follow the new shapes. Vivid (pills) and Playful (thick outlines) keep theirs.

## Home, without repeats

- **Kept:**
  - The greeting and today's focus, with the one timer button on the page.
  - Today: tasks and study sessions due, with a count in its title, the next class and cards due as single lines, and the add field.
  - Jump back in: recent items.
  - Weak spots.
  - This week.
- **Removed:**
  - The stat tiles: their facts move into Today.
  - The four shortcut tiles: the sidebar has them.
  - "Your courses": the sidebar and the Courses page have them.

## Not in this round

New looks or accents, the note editor, the Focus page, the public pages.
