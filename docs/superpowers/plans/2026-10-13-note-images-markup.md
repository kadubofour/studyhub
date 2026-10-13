# Images in notes and markup: plan

Spec: docs/superpowers/specs/2026-10-13-note-images-markup-design.md. Native execution, TDD per task, an Opus review of the whole branch at the end.

1. Migration: private `note-images` bucket and its policies; DB tests.
2. `lib/notes/images`: tokens, find/swap/strip, signed-link cache; unit tests.
3. Image preparation (shrink, type and size checks) and upload; unit tests with a canvas stand-in.
4. Tiptap Image node with a node view that resolves the token; Markdown round trip tests.
5. RichEditor: Image and Draw buttons, paste and drop; tests.
6. MarkdownView and print page draw images; Word export embeds them; AI input strips them; account delete includes the bucket.
7. `lib/markup`: marks, history, hit test, drawing, flatten; unit tests.
8. ImageMarkup dialog (tools, colours, sizes, undo/redo, Done/Cancel); tests.
9. Wire Markup and Draw into the editor (image bar, double-click, replace and clean up); tests.
10. E2E and accessibility; full suites; review; fix pass.
