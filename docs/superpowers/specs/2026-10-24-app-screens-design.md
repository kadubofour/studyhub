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

- **Home:** "What do I do today?" The greeting's line answers it. A strip of quick actions follows: cards to
  review, the next class, a quiz and the tutor. Then Today, with the This week chart beside it.
- **Courses:** "What am I taking?" New course is one click from the title, and also in the empty state.
- **Progress:** "How am I doing?" Start focus, Review cards, Ask the tutor and New note sit by the title on every
  screen, not on phones only.

## What changed in the shared system

- The sidebar recedes in Classic, Studio, Paper and Vivid: it sits on the page ground with a hairline, and the
  current place is a neutral pill. Vivid keeps the student's colour off it. Playful keeps its purple sidebar,
  which is its character.
- Page titles are app-sized (26-28px, `PAGE_TITLE`); `PageHeader` takes a one-line `summary`. Panel titles are 18px.
- The page is flat: the leftover accent glow (the aurora, never shown since every app root has a look) and the
  hero's corner glow are gone.
- Classic's soft surface is the warm grey `#EFEEEA`, not the banned cream `#F0EEE6`.
- Home's quick actions are plain cells split by hairlines, with no tinted tiles and no icons in coloured circles.
  Jump back in marks each kind with a plain grey icon.
- This week: today in the student's colour, the other days in grey, the daily goal as a dashed line and the
  week's total in the header.
- Facts said once: the cards due and the next class moved from Today to the quick actions.

## Kept, by the student's earlier choices

The accent hero on Home, the Create button holding New note, deck and upload (the Library does not repeat them),
and each look's title face.
