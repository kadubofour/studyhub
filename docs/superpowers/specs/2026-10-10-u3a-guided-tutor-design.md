# U3a: Guided mode for the tutor

First of three U3 builds (U3a guided tutor, U3b XP and daily objectives, U3c games). Guided mode makes the
tutor teach by asking instead of telling, for as long as the student wants.

## 1. Goal

A student can switch a tutor chat into guided mode. The tutor then asks what they think before explaining,
gives hints one step at a time, checks their answers, and only gives the full answer when asked; two buttons
make asking effortless. Success: in a guided chat the first reply to a problem is a question or a first hint,
"Give me a hint" gets the next hint, "Show the answer" gets the full answer and explanation, and the chat
stays guided when the student comes back.

## 2. Decisions made

| Question | Decision |
|---|---|
| Where the switch lives | Per chat, in the chat header next to Rename; remembered for that chat; new chats start off |
| How strict | Try first, hints in steps, answer on request; never refuses to show the answer |
| Quick replies | While a chat is guided and has messages, two buttons under the message box: **Give me a hint** and **Show the answer** |
| Cost | None extra: a different instruction to the same model; the buttons send ordinary tutor messages |
| Not in this build | Starting weak-spot chats guided automatically, a guided default in Settings, scoring or XP (U3b) |

## 3. Data

New migration `20261018000000_tutor_guided.sql`: `tutor_chats.guided boolean not null default false`. The
existing row-level security applies (a student reads and changes only their own chats). `TutorChat` gains
`guided`; `setChatGuided(sb, id, guided)` saves it.

## 4. The tutor in guided mode

`tutorInstructions(hasNote, guided)` adds a guided block when `guided` is true, and the route passes
`chat.guided`. The block says:

- Ask the student what they think, or what they have tried, before explaining. For a problem or a
  question that checks understanding, do not give the answer in the first reply.
- Give one hint at a time, the smallest that moves them forward. Check what they answer: say exactly what
  is right, what is wrong, and why.
- If they say they do not know, or ask for a hint, give the next hint.
- If they ask to see the answer, give it in full with the explanation. Never refuse.
- When they reach the answer, summarise in two or three lines and offer one short follow-up question.
- Requests to make a note, flashcards, a quiz or a task are done as normal, not turned into questions.

Everything else in the instructions is unchanged, and a chat that is not guided gets exactly the instructions
it gets today.

## 5. The screen

- **Header:** a "Guided" switch (role switch, named "Guided", with a short hidden description) between the
  course picker and Rename. Turning it on or off applies at once and saves; if saving fails it goes back and
  says "Couldn't change guided mode."
- **Buttons:** under the conversation, above the message box, **Give me a hint** and **Show the answer**,
  shown only while the chat is guided and has at least one message. Each sends its message ("Give me a
  hint." or "Show me the answer.") straight away as a normal tutor message, counting as one as usual, and
  leaves whatever the student has typed in the box alone. They are off while a reply is being written.
- A chat that is not guided looks exactly as it does now.

## 6. Edge cases

| Situation | Behaviour |
|---|---|
| Switch toggled while a reply is being written | Applies to the next message |
| The tutor limit is reached | The usual limit prompt; the buttons behave like Send |
| An old chat from before this build | Not guided (the column defaults to off) |
| Saving fails | The switch goes back, with the message above |

## 7. Testing

- **DB:** `guided` defaults off, the owner can change it, another student cannot.
- **Unit:** the guided instructions (each rule present, and absent when not guided); the route passes the
  chat's setting; `setChatGuided`; the switch shows the state, saves, rolls back and says so on failure; the
  buttons show only when guided and the chat has messages, send the right message, and leave the draft box
  alone.
- **E2E (fake AI):** turn guided on, reload and it is still on; the buttons appear only after the first
  message; "Give me a hint" appears in the conversation and gets a reply; turning it off removes the buttons.
- Each step ends with unit, DB and E2E tests green, lint and build clean, and a commit.

## 8. Build order

1. Migration, data, instructions and route.
2. The switch and the buttons in the chat.
3. E2E and a look at it in Classic and Paper on desktop and phone.
