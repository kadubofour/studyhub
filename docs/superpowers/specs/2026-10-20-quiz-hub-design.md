# Quiz page: design

## Understanding

- **Said:** a dedicated quiz page where all the quiz information is kept.
- **Today:** Quiz in the sidebar only opens the "Quiz yourself" dialog; made quizzes are a short list inside it, and scores are spread over the note page and Progress.
- **Assumed (recommended options):** `/quiz` becomes a real page and a sidebar item (the dialog still starts a new quiz, from a "New quiz" button there and from Home, Library and Flashcards); no new tables, everything comes from quizzes and finished attempts already stored.

## The page

| Part | Shows |
|---|---|
| Header | "New quiz" (opens the existing dialog) |
| Numbers | Quizzes taken (and how many made, this week), average score, best score, questions right of answered |
| Recent scores | The last 12 attempts as bars, oldest to latest |
| By course | Average score and tries per course (and quizzes on no course), weakest first |
| Worth another go | Up to three quizzes whose last try scored under 60%, with Retake |
| All quizzes | Every quiz: title, course, note, questions, times taken, best, last score and date; search, course filter, sort (newest, oldest, lowest score, most taken); Take or Retake; Delete (asks first) |
| Empty | "No quizzes yet" with a button to make the first |

The quiz dialog gets an "All quizzes and scores" link, which is how a phone reaches the page (the phone bar has no room for it).

## Parts

`lib/quiz/hub.ts` (pure: `buildQuizHub`, `filterRows`), `listQuizHub` and `deleteQuiz` in `lib/data/quizzes.ts`, `app/(app)/quiz/page.tsx`, a Quiz item in the sidebar's Study group and the top bar's page names.

## Not in this piece

Reviewing a past attempt answer by answer (the results screen only exists for the attempt just finished), per-topic breakdowns (Progress has weak topics), sharing.
