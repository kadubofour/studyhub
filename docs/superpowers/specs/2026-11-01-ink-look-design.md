# The looks, rebuilt on Ink

**Ink was the first version** (the student compared Studyhub with StudyFetch and found it "too claude-made"). The student then asked for two things: **make Ink the Classic theme, and model every other theme on it.** Ink's design is now Classic, the default, and the `ink` value goes. The other looks are built on the same system and keep their own character.

## The system every look shares

- **No glass, blur, accent glow or gradient wash.** The page is a flat colour.
- **Cards and tiles:** the raised colour, a 1px line border, 16px corners and no shadow. A tile you can click gets a faint neutral shadow on hover.
- **Main button:** a pill. By default it is filled with the text colour (an "ink pill"), with the page colour as its text.
- **Other buttons:** raised pills with a 1px line. Quiet and danger buttons are pills too.
- **Fields:** the raised colour with 12px corners. **Menus:** raised, a 1px border and a small neutral shadow.
- **Section titles:** 22px at weight 500, in the look's title face (`--title-font`), unless the student chose a font.
- **The sidebar** is dark in every look and both modes, with its own readable text. The current place is a lighter pill, and every item is a pill.
- **Selected chips and list items** (`--accent-soft` and `--accent`) are a quiet tint of the page with text-coloured text, except where a look below says otherwise.
- **Pastel tiles** (`--tile-a/b/c`) are the look's own.

## The looks

| Look | Character | Title face | Main button and selection | Sidebar |
|---|---|---|---|---|
| **Classic** (default) | warm paper `#F7F6F0`, white cards | Newsreader (serif) | ink pill, neutral selection | `#191918` |
| **Studio** | cool midnight-blue, flat | Instrument Sans | ink pill, neutral selection | `#151628`; `#090A12` in dark |
| **Paper** (light only; Classic in dark) | cream `#F6F0E4`, cream cards | Lora (serif) | ink pill, neutral selection | warm brown `#2A2520` |
| **Vivid** | light neutral, with colour where it counts | Instrument Sans, bold | the accent pill, accent selection | `#1F2127` |
| **Playful** | fresh green, 2px outlines | Nunito (rounded) | the accent pill with a darker bottom edge that presses down, accent selection | deep green `#22301C` |

The colours of each look are listed in `lib/appearance.ts` (LOOKS) and checked against `app/globals.css`, and for contrast, by `tests/unit/looks.test.ts`.

## Data

- `profiles.look` takes `classic`, `studio`, `paper`, `vivid` or `playful`, and **new accounts start on Classic**. The look migration `20261105000000_look_studio.sql` has not been released, so it is changed in place.
- Existing accounts keep what they chose. Those on Classic now see the new Classic.
