# Ink: a look that does not read as machine-made

The student compared Studyhub with StudyFetch and found Studyhub "too claude-made". Studio's midnight glass, accent glow and gradient wash are the usual signs. StudyFetch reads as a product: warm paper, flat white cards, a serif for titles, black pill buttons and a dark sidebar. Ink takes those principles. It does not take StudyFetch's brand: not its name, mascot, illustrations or exact typefaces.

Ink becomes the default look. Studio, Classic, Paper, Vivid and Playful stay in Settings.

## Tokens

| | Light | Dark |
|---|---|---|
| page | `#F7F6F0` warm paper | `#151514` |
| raised (cards) | `#FFFFFF` | `#1E1E1C` |
| surface (side panels, quiet fills) | `#F0EEE6` | `#262624` |
| line | `#E4E2DA` | `#33322F` |
| text | `#191918` | `#F2F1EC` |
| quiet text | `#66655E` | `#A3A29B` |

- **Surfaces:** no glass, no blur, no aurora, no coloured shadows.
- **Shadows:** cards have none. A tile you can click lifts with a faint neutral shadow on hover.
- **Pastel blocks** are the only big areas of colour. They are used for `.tile-a/b/c` and feature tiles: lilac `#ECE1FA`, butter `#FAF0B4` and aqua `#CDEFF0`. In dark mode they are deep versions of the same colours.

## Type

- **Titles** (page titles, section titles, the greeting and tile titles) use the serif **Newsreader**, weight 500. Section titles are 22px.
- **Body text** is the student's chosen font (Inter by default).
- A student who chose a font other than Sans keeps it for titles too.

## Controls

- **Primary button:** an ink pill. The background is the text colour (near-black in light mode, near-white in dark mode), the text is the page colour, the weight is 500 and there is no shadow.
- **Secondary button:** a white pill with a 1px line border. On hover it fills with the surface colour.
- **Quiet buttons** and **danger buttons** are pills too.
- **Fields:** white, with a 1px line border and 12px corners. The focus ring is in the accent.
- **Cards and tiles:** white, with a 1px line border, 16px corners and no shadow.
- **Side panels** (for example Home's This week) use the surface colour.
- **Menus and dialogs:** white, with a 1px border and a small neutral shadow.
- **The student's accent** is kept for small things: the focus ring, selection, progress, small icons, links and the Home hero.

## The sidebar

- It is dark in both modes (`#191918`), with text `#EDEDE8` and quiet text `#A3A29B`.
- The current place is a lighter pill (`#2F2F2D`) with white text.
- Every item is a pill.
- Tooltips and menus inside it are dark too.

## Default

- New accounts start on Ink. The unreleased look migration `20261105000000_look_studio.sql` changes to allow `ink` and to make it the default.
- `lookOf` falls back to Ink.
- Existing accounts keep the look they saved.
