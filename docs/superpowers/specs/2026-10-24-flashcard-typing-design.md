# Flashcard answers typed in the app: design

## Understanding

- **Said:** "Do you think they should be able to answer the flash cards in app" and then "do that" (to my recommendation).
- **Found:** Review is flip-only: read the front, press Show answer, rate yourself. Nothing is checked.
- **Assumed (recommended options):** typing is a choice, not forced; no AI and no cost (a local comparison); the rating is suggested, never forced; no database change; the choice is remembered on this device.

## What changes

| Part | Behaviour |
|---|---|
| Mode | On Review, a switch between "Flip" and "Type answer". Remembered on this device. Default Flip. |
| Typing | In Type answer mode the card shows a box (and a microphone where the browser can dictate) and a Check button. Enter checks, Shift+Enter starts a new line. "I don't know" shows the answer without typing. |
| Check | Shows your answer beside the real one with a verdict: Correct, Close, or Not quite. Then the usual four rating buttons, with the suggested one highlighted (Correct: Good, Close: Hard, Not quite: Again). The student can press any. |
| Comparison | Local and forgiving: ignores capitals, spaces, punctuation and simple formatting marks; one-letter slips on short answers and most-words-right on long ones count as Close. |
| Keys | 1 to 4 rate after checking, as today. Typing in the box never triggers a shortcut. |

## Parts

`lib/ui/answerCheck.ts` (pure), `lib/ui/reviewMode.ts` (remembered choice), `app/(app)/review/page.tsx`, a small `components/flashcards/TypedAnswer.tsx`; reuses the Tutor's `useDictation`.

## Not in this round

"Ask the tutor if I'm right" for long answers, spoken answers marked automatically, per-deck mode.
