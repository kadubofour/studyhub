# Studyhub "Studio" redesign: design

## Understanding

- **Said:**
  - "I dont think you get what i mean by redesign."
  - Asked for a direction: **Sleek and premium**, dark-first, layered glassy panels, subtle glow, smooth motion, in the spirit of Linear, Arc and Raycast.
  - Asked how far: **Completely new**: new layout and navigation, not a new skin.
- **So:** this replaces the app's look and its navigation. The four looks (Classic, Paper, Vivid, Playful) are retired: there is one design, in dark (the default) and light. The student still picks their accent colour and font.

## The idea

Studyhub becomes a quiet, fast workspace. You move by **command**: one keystroke (Ctrl/⌘ K, or the search pill) opens a palette that jumps anywhere (pages, courses, notes, decks, lectures) and does anything (new note, start focus, upload, scan, ask the tutor). The chrome around the page shrinks to a slim rail, so the page owns the screen.

## Visual language

- **Base (dark):**
  - Midnight ink #0E0F1A, with a soft aurora of the student's accent glowing from the top of every page.
  - Panels are layered glass: #171927 at 72% over the glow, blurred, with a 1 px light top edge (white at 7%) and a hairline border (white at 8%).
  - Text #ECEDF7, muted #9196B3.
- **Base (light):** #F5F6FB with the same aurora, much fainter. Panels are white glass at 80% with a soft border. Text #151628, muted #5E6283.
- **Type:**
  - Instrument Sans for titles and numbers: tight, elegant, with tabular figures.
  - The student's font, Inter by default, for text.
  - Page titles 34 px, panel titles 15 px semibold in the text colour.
- **Controls:**
  - Buttons are 36 px (44 on touch) with 10 px corners. The primary button is the accent with a faint inner light and a soft glow on hover; secondary is glass; quiet is text.
  - Keyboard shortcuts show as small keycaps.
- **Motion:** one orchestrated moment, the palette opening (scale and fade, 140 ms). Panels lift a little on hover. Everything respects reduced motion.

## Layout and navigation

```
desktop
┌──┬───────────────────────────────────────────────┐
│◉ │  ⌕ Search or jump…  Ctrl K        [status pill]│
│⌂ │                                                │
│▦ │  Page title                        [actions]   │
│◷ │  ──────────────────────────────────────────    │
│▤ │  page content (bento of glass panels)          │
│✎ │                                                │
│▣ │                                                │
│✦ │                                                │
│  │                                                │
│⚙ │                                                │
│Ⓚ │                                                │
└──┴───────────────────────────────────────────────┘
rail: 68 px, icons with labels on hover, + (Create) at the top

phone
┌──────────────────────────┐
│ Page title         ⌕     │
│                          │
│ content                  │
│                          │
│  ╭──────────────────────╮│
│  │ ⌂  ▦  ( + )  ✎  ▣   ││  floating glass dock
│  ╰──────────────────────╯│
└──────────────────────────┘
```

- **Rail (desktop):**
  - Studyhub's mark and a **Create** button (+), then Home, Planner, Focus, Notes, Flashcards, Lectures, Tutor, Quiz, Library and Progress.
  - At the bottom: theme, Settings, and the student's avatar for Profile.
  - Each item is an icon with its name in a tooltip, and the active one glows.
  - Courses move into the palette and the Courses page.
- **Command palette:** jump to pages, courses and recent material; actions such as New note, New deck, Upload, Scan, Start focus, Ask the tutor, Review cards and Light/Dark. You type to filter, use the arrow keys and Enter, and Escape closes it.
- **Create menu (+):** New note, New deck, Record lecture, Upload, Scan and New task.
- **Status pill:** at the top right, only when there is something to say: the timer while it runs, cards due, and the level with its bar.
- **Phone:**
  - A floating glass dock with Home, Planner, + (Create), Notes and Flashcards.
  - A search button at the top opens the palette, where everything else is.

## Home, rebuilt

A bento of glass panels:

```
┌────────────────────────────┬──────────────┐
│ Good evening, Kwadwo       │  Focus orb   │
│ Thursday 22 October        │  25:00  ▶    │
├──────────────┬─────────────┤──────────────┤
│ Today        │ Up next     │ This week    │
│ tasks, add   │ class, due  │ bars         │
├──────────────┴─────────────┴──────────────┤
│ Jump back in (recent material)            │
├───────────────────────────────────────────┤
│ Weak spots (when any)                     │
└───────────────────────────────────────────┘
```

## Reviewed against the defaults

- **Near-black with one acid accent (a known default):**
  - Changed: the base is a midnight blue ink, not #111.
  - The accent is the student's own, used as light (the aurora, the glow), not as a neon outline.
- **The SaaS card kit:**
  - Panels are layered glass with a lit top edge.
  - Corners scale with size: 10 px controls, 16 px panels, 24 px the hero.
  - There is no grey drop shadow.
- **The specific thing:** the palette-first navigation and the aurora behind every page.

## Parts and order

1. Tokens, fonts, glass panels, controls; the looks retired (Settings keeps accent, font, width and theme).
2. Shell: rail, command palette, create menu, status pill, phone dock (replacing the sidebar, the top bar and the tab bar).
3. Home bento.
4. A pass over every other page so each sits in the new frame.

## Not in this round

The note editor's own toolbar, the public site.
