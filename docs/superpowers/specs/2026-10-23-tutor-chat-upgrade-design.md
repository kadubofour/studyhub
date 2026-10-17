# Tutor chat upgrade: design

## Understanding

- **Said:** "And upgrade the chat too", after the Tutor page upgrade (which already added Stop, Try again, Copy, Regenerate, follow-ups, inline rename, what the chat is about, the allowance).
- **Found in the conversation itself:** the page jumps to the newest text on every piece of a reply, so a student who scrolled up to re-read is pulled back down; the message box is always two lines, and on a phone Enter sends (no way to start a new line); an empty chat is one line of text with nothing to try; messages carry no time and no day; your own questions cannot be copied and the conversation cannot be taken out as a whole; the wait for a reply is plain text.
- **Assumed (recommended options):** no database change; no new server work; this round does not touch what is sent (so "edit a question" and "replace the old reply" stay out, they need the server).

## What changes

| Part | Behaviour |
|---|---|
| Scrolling | The page follows a reply only while the student is at (or near) the bottom. Scrolled up, it stays put and a "Latest" button appears above the message box; tapping it goes to the newest text. Sending a message always goes to the bottom. |
| Message box | Grows with what is typed, up to about eight lines, then scrolls. Within 500 characters of the 4000 limit a count shows. On a phone (touch) Enter starts a new line and the Send button sends; with a mouse Enter sends and Shift+Enter starts a new line. |
| Empty chat | Four ideas (the Tutor page's starters, filled in with the note or lecture the chat is about) that put the message in the box, ready to change and send. Nothing is sent. |
| Times | Each message shows the time it was sent. A day heading (Today, Yesterday, or the date) appears where the day changes. |
| Your questions | A Copy button under each. |
| The whole chat | A "Copy chat" button at the top puts the whole conversation on the clipboard as plain text: the title, then "You:" and "Tutor:" turns. |
| Waiting | "Thinking…" gently pulses (still when the device asks for less motion). |

## Parts

`lib/tutor/conversation.ts` (pure: `nearBottom`, `dayHeading`, `timeOf`, `transcript`), `components/tutor/ChatView.tsx`. Reuses `STARTERS` and `starterMessage`.

## Not in this round

Editing a sent question, replacing the old reply when regenerating (server), photo upload, voice input, pinning, export to a file.
