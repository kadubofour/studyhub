# U1: Looks — Classic and Paper

Part of the StudyFetch-inspired upgrade (U1 visual, U2 topics and the adaptive plan, U3 play and
motivation). U1 is deliberately small: a choice of look, not a redesign.

## 1. Goal

A student can choose how Studyhub looks. **Classic** is exactly what the app looks like today and stays
the default. **Paper** is a warm version of the same app: cream backgrounds, warmer greys, soft pastel
tints on the Home tiles. Layout, spacing, corners, buttons and every feature stay the same. Success: a
student switches the look in Settings, the whole app changes at once, the choice is remembered on every
device, and every piece of text stays readable (WCAG AA) in both looks, in light and dark, with any of the
six accent colours.

## 2. Decisions made

| Question | Decision |
|---|---|
| How different? | Very similar to today: colours and a few details only, no layout change |
| How many looks? | Two: Classic (default, unchanged) and Paper |
| Font | The student's font choice always wins. Paper's serif greeting shows only while the font is the default Sans |
| Accent colour, light/dark/system | Still chosen separately and work on top of either look |
| Home | No new cards or sections. Paper only changes the colours of the existing tiles |
| Floating tutor panel | Not part of this work |

## 3. Data

- `profiles.look text not null default 'classic' check (look in ('classic','paper'))`, added by migration
  `20261015000000_look.sql`. Existing students get `classic`, so nothing changes for them until they choose.
- `Profile` type gains `look: LookName`; `updateProfile` already takes a partial patch.

## 4. How a look is applied

- `lib/appearance.ts` gains `LOOKS` (`classic`, `paper`, each with a `label` and a one-line `blurb`), `LookName`
  and `isLook`, next to `ACCENTS` and `FONTS`.
- `AppShell` puts `data-look="<look>"` on the `.app-root` element, as it already sets the accent and font
  variables there. Pages outside the signed-in app (sign-in, sign-up, onboarding) are not affected and
  keep the Classic colours.
- `globals.css` holds one block of variable values per look and mode. Classic needs no block: it is the
  existing `:root` and `.dark` values. Paper overrides the same variable names, so no component changes:

| Variable | Paper light | Paper dark |
|---|---|---|
| `--bg` | `#F6F0E4` | `#1C1915` |
| `--raised` | `#FFFBF2` | `#25211C` |
| `--surface` | `#EFE7D6` | `#2E2923` |
| `--line` | `#E2D8C3` | `#3A342C` |
| `--fg` | `#2A2520` | `#EFE8DA` |
| `--muted` | `#6E6455` | `#A39A8A` |
| `--shadow` | the same shape with a warm tint (`rgb(60 45 20 / …)`) | the same as Classic dark |

  The values are a starting point: the contrast tests in section 8 decide the final `--muted` and any other
  value that falls short. `--danger`, `--success` and the accent variables are not overridden.
- Home tile tints: three new variables `--tile-a`, `--tile-b`, `--tile-c`. In Classic all three equal
  `--raised`, so nothing changes. In Paper light they are `#F6D9C4`, `#F3E6A8`, `#CFE6D6`, and in Paper dark
  `#4A3223`, `#4A4220`, `#243A2E`. The three Home tiles (tasks today, cards due, next class) use them.
  Text on a tint uses the normal `--fg`.
- Serif greeting: the Home greeting uses `font-family: var(--font-lora)` when the look is Paper and
  `profile.font` is `sans`; in every other case it uses the app font as today. (Lora is already loaded for
  the Serif font option; it is only fetched when used.)
- The hero gradient, buttons, menus and cards keep their current shapes. The accent still drives buttons,
  links, highlights and the hero.

## 5. Settings

The Appearance card gets a **Look** group above Accent colour: two options as small previews (a mini
page showing that look's background, a tile and a button in the current accent), labelled "Classic" and
"Paper" with their one-line blurbs. It is a radio group with the same arrow-key behaviour as Accent and
Font. Choosing a look applies at once and saves in the background; if saving fails the previous look comes
back and the usual "couldn't save" notice shows, exactly as accent and font behave today.

## 6. Edge cases

- Old cached profile without a `look`: treated as Classic.
- A look name the app doesn't know (a future look on an old client): treated as Classic.
- The print view and exported documents are not themed; they stay as today.
- The first paint: the look is applied from the profile the server already sends, so a Paper student
  doesn't see a Classic flash before it switches.

## 7. Out of scope

More looks (Bold, Slate); new pages or cards; anything about topics, plans, games or the tutor; changes to
the sign-in pages; a look for print.

## 8. Testing

- Unit (`appearance.test.ts`): `LOOKS` has exactly `classic` and `paper`; `isLook` accepts only those;
  for each look and mode, `--fg` on `--bg`, `--raised` and `--surface` is at least 4.5:1, `--muted` on `--bg`
  and `--raised` is at least 4.5:1, and `--fg` on each Home tile tint is at least 4.5:1; every accent's
  `text` on Paper light `--bg`/`--raised` and `textDark` on Paper dark `--bg`/`--raised` is at least 4.5:1, so
  all six accents stay readable.
- Unit (component): the Appearance card shows the two looks, marks the current one, applies and saves the
  choice, rolls back on a failed save, and arrow keys move between looks; `AppShell` puts the right
  `data-look` on the root; the Home greeting is serif only for Paper plus Sans.
- DB: `profiles.look` defaults to `classic`, accepts `paper`, rejects anything else, and a student can
  change only their own.
- E2E: choose Paper in Settings, see the app root switch to Paper, reload and still see it; switch back
  to Classic; Paper with dark mode on.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 9. Build order

1. Migration and DB test; `Profile` type and `LOOKS` with contrast tests.
2. Paper variables in `globals.css`, `data-look` on the app root, tile tint variables and the Home tiles.
3. The Look picker in Settings and the serif greeting rule.
4. E2E and a look at it on desktop and phone width in light and dark.
