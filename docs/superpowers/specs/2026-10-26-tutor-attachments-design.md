# Files and photos in the Tutor's message bar: design

## Understanding

- **Said:** "take the search bar out and the upload button beside it, i meant in the message bar, the one used to send messages, thats where the upload button should be and i mean adding files and photos when i say upload".
- **So:** the Tutor page loses its chat search and the Upload button beside it (done separately). A chat's message bar gains a button to add files and photos to the message, and the tutor reads them with the question.
- **Found:** Scan already shrinks phone photos in the browser and uploads them to a private storage folder the server reads with the student's own session (`lib/scan/scanClient.ts`, `app/api/ai/scan/route.ts`); the browser already turns Word, PowerPoint and text files into Markdown (`lib/import/*`); the tutor route sends the model a text-only message.
- **Assumed (recommended options):**
  - Photos (JPEG, PNG, WebP), PDFs, and Word, PowerPoint and text files. Audio and video are refused with a pointer to Lectures, as Upload does.
  - Files stay with the chat, so a follow-up ("and part b?") still has the photo. They live in a new private bucket, `tutor-files`, under `<user>/<chat>/`, and are deleted with the chat and with the account.
  - A message with attachments still costs one tutor message. To keep that affordable: at most 4 attachments a message, photos and PDF pages at most 10 together, a PDF at most 24 MB, a document's text at most 30,000 characters (longer is shortened, and the chip says so). The tutor also re-reads the attachments of the last two questions that had any, within the same 10 page limit, and older ones are named only.
  - Text is optional when something is attached.

## What changes

| Part | Behaviour |
|---|---|
| Message bar | A paperclip button ("Add files or photos") beside Guided. Photos can also be pasted or dropped onto the bar. Each attachment shows as a chip above the text (a small picture for a photo), with a remove button, and "Reading…" while a document is read. Problems (too many, too large, a file that cannot be read, audio) show under the bar; nothing is lost. |
| Sending | Photos are shrunk (as in Scan) and uploaded with PDFs; documents go as their text. If the upload fails, nothing is sent and the message and files stay. Send works with files and no text. |
| The tutor | Reads the photos and PDFs and the documents' text with the question, as material (not instructions). |
| The conversation | A question shows its attachments as chips under it; a photo or PDF opens in a new tab. Try again and Regenerate send the same attachments. |
| Deleting | Deleting a chat deletes its files; deleting the account deletes them all. |

## Parts

Migration `20261104000000_tutor_attachments.sql` (column `tutor_messages.attachments`, bucket and policies). `lib/tutor/attachments.ts` (limits, types, checks shared by browser and server), `lib/tutor/attachClient.ts` (browser: read, shrink, upload), `lib/ai/tutorAttachments.ts` (server: fetch, build what the model reads), the tutor route, `lib/tutor/stream.ts`, `lib/data/tutor.ts`, `components/tutor/AttachmentChips.tsx`, `ChatView`, account deletion.

## Not in this round

Audio and video, attachments in the Tutor page's starters, a gallery of a chat's files, charging extra AI actions for long PDFs.
