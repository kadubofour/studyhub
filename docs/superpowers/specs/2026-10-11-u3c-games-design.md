# U3c: Study games from your own flashcards

Third and last U3 build. Two short games made from a deck's cards, paying XP through the U3b system. No AI, so no cost and no limit.

## 1. Goal
From a deck, a student can play **Match** or **Speed round** on its cards, see a score, and earn a little XP. Success: a deck with 4+ cards shows Play buttons; finishing a game shows the score, records the play, and Home/Progress XP rises.

## 2. Decisions made
| Question | Decision |
|---|---|
| Material | The cards of one deck (no AI, no quiz questions in this build) |
| Games | Match (pair terms with definitions) and Speed round (pick the right back for a front) |
| Timers | None: pace is the student's, so it is fair on every device and for screen readers |
| Spaced repetition | Games never change a card's schedule or add reviews |
| XP | 8 XP per finished game, up to 3 games a day (24 XP); games count for the streak, not for the three daily goals |
| Minimum | 4 cards (fewer: Play is disabled with a hint) |
| Where | A "Play" menu on the deck page; games at `/flashcards/[deck]/play?game=match|speed` |
| Not in this build | Quiz-question games, timers, leaderboards, sound, animation |

## 3. Data
Migration `20261020000000_games.sql`: table `game_plays` (id, user_id default auth.uid(), deck_id references decks on delete set null, game 'match'|'speed', score int >= 0, total int 1..30, check score <= total, created_at), RLS "own rows" with `owns_deck` check when deck_id is set. `activity_by_day` gains a `games` count column (function replaced).

## 4. The games (pure rules in `lib/games`)
- **Match:** up to 6 cards chosen at random; the board shows 6 fronts and 6 backs shuffled separately; the student taps one of each; a right pair locks as matched, a wrong pair counts a miss. Done when all are matched. Score = pairs matched first time (cards with no miss); total = pairs.
- **Speed round:** up to 10 cards at random; each question shows a front and four backs (the right one and three others from the deck, all different text); picking shows right/wrong with words, then Next. Score = right answers; total = questions. Cards whose back text equals another's are asked only if three distinct wrong backs exist.
- Both finish on a results screen: "Score 5 / 6", Play again, Back to deck. The play is saved when the results appear; a failed save shows a note and the results still show.

## 5. XP
`game_plays` rows per local day, 8 XP each, capped at 3 per day, added to `dayXp`; they make the day "active" for the streak. Goals and the all-goals bonus are unchanged.

## 6. Edge cases
| Situation | Behaviour |
|---|---|
| Deck has fewer than 4 cards, or deleted | Buttons disabled with a hint; the play page returns to the deck/list |
| Cards with identical backs | Speed round skips questions that lack three distinct wrong answers; if fewer than 4 remain, it says the deck has too many repeated answers |
| Leaving mid-game | Nothing is saved |
| Math in cards | Shown with the existing card renderer |
| Save fails | Results show with "Couldn't save this play" |

## 7. Testing
DB: own rows only, constraints, deck-ownership check, `games` counted per local day. Unit: game builders (sizes, distinct options, right answer present, repeated backs), XP rule (8 each, cap 3, streak), both components (play through, scoring, results, save failure). E2E: make a deck of cards, play Speed round and Match, XP on Home rises by 16.

## 8. Build order
1. Migration, DB tests, XP rule. 2. Game builders. 3. Components, data, play page, deck button. 4. E2E, review, fixes.
