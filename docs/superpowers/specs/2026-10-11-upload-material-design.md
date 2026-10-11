# Upload material

Today a student can import a Word file or a PDF only from inside Notes ("Import"), and photos only through Scan. Other study apps put **Upload** up front and accept the files students actually have (slides, text, PDFs, photos, recordings). This makes Upload a first-class action.

## 1. Goal
From anywhere in the app a student presses **Upload material**, picks a file, checks what was read, and gets a note, with a choice of what to do next. Success: uploading a PowerPoint or a text file from the sidebar creates a note in the chosen course, and the student can land straight on the Summary, Cards or Quiz tab of that note.

## 2. Decisions made
| Question | Decision |
|---|---|
| Entry | An **Upload** button in the sidebar's Study group (next to Scan) opens the dialog from any page; the Notes page's Import buttons become Upload and open the same dialog |
| Files | PDF and Word (as today), **PowerPoint (.pptx)** and **plain text or Markdown (.txt, .md)** (new), one file at a time |
| Photos | A photo or screenshot picked here is sent to Scan (the existing reader for photos), not read a second way |
| Recordings | Audio and video are recorded or uploaded in Lectures; picking one here points there |
| Reading | PowerPoint and text are read in the browser (no AI, no cost); PDF keeps its AI structuring and cost |
| Review | The text is shown for checking and editing the title before anything is saved, as for PDF and Word today |
| After saving | The student chooses: just open the note, or open it with the Summary, Cards or Quiz tab ready. Nothing is generated until they press the button there, so the cost stays visible |
| Keeping the original file | Not in this build |
| Not in this build | Several files at once, keeping the source file, links and YouTube addresses, Google Docs |

## 3. Reading the files
- **PowerPoint:** slides in order. Each becomes `## Slide n: <its title>` (the first text, or "Slide n") followed by its other text as bullet lines, and its speaker notes in italics under "Notes:". Pictures are ignored. Up to 200 slides.
- **Text and Markdown:** the title is the first Markdown heading, else the file name without its extension; the body is the text with Markdown kept as is. Up to 1 MB.
- A file with no readable text gives the existing "This file had no text" preview.
- A wrong extension, an empty file or a broken archive gives "Couldn't read that file. Try another one."

## 4. Screen
The dialog title is "Upload material". Its drop area says "Choose a file", names the types, and states the AI cost only for PDFs. A photo or recording shows a short message with a button (Open Scan / Go to Lectures) and closes without reading anything. The review step gains "After saving" with four options: Open the note (default), Open with Summary, Open with Flashcards, Open with Quiz. The note page opens its Study panel on that tab when it is reached with `?study=summary|cards|quiz`, then drops the parameter from the address.

## 5. Edge cases
| Situation | Behaviour |
|---|---|
| Upload chosen while a lecture is recording | Opening the dialog is fine; saving navigates, so the existing "Stop recording?" guard applies |
| Same file twice | Two notes (as with import today) |
| Dialog closed while a PDF is converting | The conversion is cancelled (as today) |
| `?study=` with another value | Ignored |

## 6. Testing
Unit: file kind detection; PowerPoint reading (order, titles, notes, empty slides, bad archive, slide cap); text reading; the dialog (each kind, photo and audio hand-offs, after-saving choice, errors); the sidebar button; the note page tab parameter. E2E: upload a text file from the sidebar, then a PowerPoint, land on the Cards tab.

## 7. Build order
1. File kinds and readers. 2. Dialog. 3. Sidebar button and shell wiring. 4. Note page tab parameter. 5. E2E, review, fixes.
