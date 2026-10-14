# Images in notes, and a markup tool

Notes are text only. Students need to put pictures in them (a slide, a diagram, a photo of the board) and mark them up (circle the part that matters, draw an arrow, write on it), and to sketch something from nothing.

## Decisions
| Question | Decision |
|---|---|
| Ways to add an image | A toolbar **Image** button (file picker, several files allowed), **paste** (a screenshot), and **drag and drop** into the note. All three do the same thing |
| Making a sketch | A toolbar **Draw** button opens the markup tool on a blank white page; Done puts the drawing in the note as an image |
| Marking up an image | Click an image to select it: a small bar appears on it with **Markup** and **Remove**. Double-click opens Markup too |
| Markup tools | Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Text, Eraser (removes a whole mark), Undo, Redo, Clear; six colours and three sizes |
| Saving markup | Done flattens the marks onto a copy of the image and saves it as a new image in the note; the old file is removed once nothing in the note uses it. Cancel changes nothing |
| Where files live | A private storage bucket `note-images`, one folder per student, `<user id>/<uuid>.<ext>`. Only the student can read or write their folder |
| What the note holds | The text of the note stays Markdown: `![alt](studyhub-image:<uuid>.<ext>)`. The picture's address is worked out when it is drawn (a signed link, kept for 50 minutes in the page), so nothing in the note expires |
| Size | Photos are shrunk to at most 1600 px on the long side and saved as WebP (GIFs and SVGs are not accepted: PNG, JPEG, WebP only); at most 5 MB each after shrinking. A friendly message says when one is too big or the wrong type |
| Where images show | The editor, the read-only note view, the print page (PDF) and the Word export (embedded) |
| What the AI sees | Study tools (quiz, flashcards, summary, tutor) get the note with each image replaced by its alt text, so pictures never cost tokens or confuse them |
| Accounts | Deleting an account removes the image folder with the rest; the data download lists the notes as written (images are not in the download, and it says so) |
| Not in this build | Resizing and aligning images in the note, captions, cropping, image search, per-student storage limits beyond the 5 MB per image, GIF animation |

## Pieces
- `lib/notes/images`: the token format (`studyhub-image:`), finding and swapping tokens in Markdown, stripping them for AI, the signed-link cache, shrinking and uploading.
- `lib/markup`: the marks (data), the history (add, erase, undo, redo, clear), hit testing for the eraser, drawing to a canvas, flattening to a file.
- `components/notes/NoteImage` (the node view), `ImageMarkup` (the dialog), toolbar buttons and paste/drop in `RichEditor`.
- `MarkdownView` draws images through the same resolver.

## Testing
Database: the bucket exists, a student can store, read and delete in their own folder and not in anyone else's, only image types, 5 MB limit. Unit: token helpers, strip for AI, URL cache, image preparation (with a stand-in for canvas), the editor round trip (insert, serialise to Markdown, load back), paste and drop, the toolbar, the markup history and hit testing, drawing calls, the dialog's tools and Done/Cancel, MarkdownView images, export. E2E: add an image from a file, see it, mark it up and save, reload and it is still there; accessibility of the dialog.
