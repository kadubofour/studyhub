# App screens: less generic, quick actions where the work is

Made with the taste skill's app-screen run (`design-taste-frontend`, `references/app-screens.md`), style dealt:
**Editorial greeting** (workspace kind, light, seed 1556281200), with the brand's palettes and typefaces kept
(`--keep palette,type`).

## The face and the signature element

- **Face:** the greeting names today's one fact from the data ("Saturday, October 24 · 1 overdue task, 2 due today
  and 1 reminder."), never "Welcome back". The date follows the greeting instead of sitting above it.
- **Signature element:** Home's hero stays the top of a notebook page in the student's colour, with its ruled lines
  and margin line. It is the one drawn pattern the lint allows (`taste-skill-ignore`).

## Each screen's question

- **Home:** "What do I do today?" The greeting's line answers it, then Today with the This week chart beside it.
- **Courses:** "What am I taking?" New course is one click from the title, and also in the empty state.
- **Progress:** "How am I doing?" Start focus, Review cards, Ask the tutor and New note sit by the title on every
  screen, not on phones only.

## What changed in the shared system

- The sidebar recedes in Classic, Paper and Vivid (Studio's is frosted): it sits on the page ground with a hairline, and the
  current place is a neutral pill. Vivid keeps the student's colour off it. Playful keeps its purple sidebar,
  which is its character.
- Page titles are app-sized (26-28px, `PAGE_TITLE`); `PageHeader` takes a one-line `summary`. Panel titles are 18px.
- The page is flat in every look but Studio: the old aurora and the hero's corner glow are gone. Studio, at the
  student's request, glows: four soft radial lights in the accent and glow colours (two from above, a wisp at the
  right, a haze from below), fixed while scrolling, stronger by night ( 24% / 44%). Its cards, menus, sidebar
  and top bar are frosted so the light shows through.
- Classic's soft surface is the warm grey `#EFEEEA`, not the banned cream `#F0EEE6`.
- Jump back in marks each kind with a plain grey icon.
- This week: today in the student's colour, the other days in grey, the daily goal as a dashed line and the
  week's total in the header.

## Kept, by the student's earlier choices

The accent hero on Home, Home's four quick cards (Take a quiz, Record lecture, Ask the tutor, Upload) on every screen, the Create button holding New note, deck and upload (the Library does not repeat them),
and each look's title face.
