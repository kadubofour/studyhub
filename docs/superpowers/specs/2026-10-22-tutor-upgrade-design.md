# Tutor upgrade: design

## Understanding

- **Said:** the Tutor page has to be upgraded.
- **Found:** the Tutor page is a plain list of chat titles and "New chat" opens an empty chat with no material attached. In a chat there is no way to stop a reply, no button to try again after a failed or cut-off reply, no copy or regenerate, no quick follow-ups, rename uses the browser's own prompt (which embedded views can block), the free daily allowance of tutor messages is invisible until it runs out, and the message box may sit over the phone's bottom bar.
- **Assumed (recommended options):** no database change (everything uses what is stored: chats, their note or lecture, their messages, and the student's tutor messages used today); a "chat about" choice is a note, a lecture or a whole course.

## What changes

| Part | Behaviour |
|---|---|
| Tutor page | Search chats; filter by course; each chat says what it is about (its note, lecture or course) and when it was last used; starter cards ("Explain a topic", "Quiz me", "Plan my revision", "Summarise my notes") that open a chat with the message ready (nothing is sent until the student presses Send); "Chat about…" opens a picker for a note, a lecture or a course, then a chat with that material attached. |
| Stop | While a reply is being written there is a Stop button. What was written stays, marked as stopped. |
| Try again | After a failed, refused-then-fixed or cut-off reply there is a Try again button that sends the same question again. |
| On a reply | Copy, and Regenerate on the newest reply (it asks the same question again). |
| Follow-ups | After a reply: Explain it simpler, Give an example, Quiz me on this, Make flashcards from this. They send that message. |
| What it is about | A line at the top says which note or lecture the tutor is using, with Change (the same picker) and a way to detach. Changing it affects the next message. |
| Rename | Inline: the title becomes a box; Enter saves, Escape cancels. |
| Allowance | On the free plan, under the message box: "15 of 20 tutor messages left today" (Premium shows nothing). |
| Phone | The message box sits above the bottom bar; buttons are big enough to tap. |

## Parts

`lib/tutor/starters.ts` (starters, follow-ups), `lib/tutor/chatList.ts` (search and course filter), `lib/data/tutor.ts` (`setChatContext`, `listChatContexts`), `components/tutor/TutorPickDialog.tsx`, the Tutor page, `ChatView`, `sendTutorMessage` (accepts a stop signal already).

## Not in this round

Photo upload of a problem, voice input, pinning chats, exporting a chat, a model choice.
