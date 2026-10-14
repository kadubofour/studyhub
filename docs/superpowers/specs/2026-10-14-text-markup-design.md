# Marking up the text of a note

Markup should act on the notes themselves, not only on pictures in them.

| Decision | Choice |
|---|---|
| Tools | Highlight in six colours (yellow, green, blue, pink, orange, purple), Underline, Strikethrough, all on selected text; clicking the same one again takes it off |
| Where | Toolbar of the rich editor; Ctrl/Cmd+Shift+H highlights in yellow, Ctrl/Cmd+U underlines |
| Stored as | Inline tags in the note's Markdown: `<mark class="hl hl-green">text</mark>`, `<u>text</u>`, `~~text~~` |
| Drawn in | The editor, the reading view, the Markdown preview, print/PDF; Word export keeps the highlight colour and underline |
| AI | The tags are dropped before a note is sent, the words stay |
| Safety | No raw HTML is rendered: only these exact tags are recognised and turned into marks, anything else stays plain text |
