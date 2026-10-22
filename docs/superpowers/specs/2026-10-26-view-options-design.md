# View options for notes and other lists: design

## Understanding

- **Said:** "theere should be a way to change the way notes and stuff are presented".
- **Found:** Settings already changes how the whole app looks (accent, font, look, content width). Lists, though, are fixed: Notes and Flashcards are always a grid of tiles, newest first; Lectures is always a list, newest first.
- **Assumed (recommended options):** a View control on the Notes, Flashcards and Lectures pages with a layout (Grid or List) and a sort order, remembered on this device for each page. No database change.

## What changes

| Page | Layout | Sort |
|---|---|---|
| Notes | Grid (today's tiles) or List (one compact row per note) | Recently edited (default), Title (A to Z), Course |
| Flashcards | Grid (today's tiles) or List | Most due (default), Name (A to Z), Newest |
| Lectures | List (today's rows, the default) or Grid | Newest (default), Oldest, Title (A to Z) |

The control is a pair of buttons (Grid, List) and a "Sort by" menu, next to the page's other filters. Changing it re-lays the page at once; the choice is kept per page on this device, and an unknown stored value falls back to the default.

## Parts

`lib/ui/listView.ts` (choices, the remembered value, the sorts), `components/ui/ViewOptions.tsx`, the three pages.

## Not in this round

Per-course or per-notebook views, choosing which details a tile shows, a preview of the note's text on the tile.
