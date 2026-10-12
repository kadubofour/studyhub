// The milestone badges on the profile. Nothing is stored: each is worked out from the totals and the XP summary.
export type Stats = {
  notes: number; decks: number; cards: number; lectures: number; lecture_minutes: number; quizzes_done: number
  focus_minutes: number; reviews: number; games: number; tutor_messages: number; courses: number
}
type Ctx = { stats: Stats; bestStreak: number; level: number }
type Def = { id: string; label: string; how: string; target: number; unit?: string; icon: 'note' | 'cards' | 'mic' | 'focus' | 'quiz' | 'game' | 'chat' | 'flame' | 'star'; value: (c: Ctx) => number }

export const BADGES: Def[] = [
  { id: 'first-note', label: 'First note', how: 'Write or upload a note', target: 1, icon: 'note', value: c => c.stats.notes },
  { id: 'note-taker', label: 'Note-taker', how: 'Have 10 notes', target: 10, icon: 'note', value: c => c.stats.notes },
  { id: 'card-collector', label: 'Card collector', how: 'Make 50 flashcards', target: 50, icon: 'cards', value: c => c.stats.cards },
  { id: 'reviewer', label: 'Reviewer', how: 'Do 100 card reviews', target: 100, icon: 'cards', value: c => c.stats.reviews },
  { id: 'first-lecture', label: 'First lecture', how: 'Record a lecture', target: 1, icon: 'mic', value: c => c.stats.lectures },
  { id: 'deep-focus', label: 'Deep focus', how: 'Focus for 10 hours', target: 10, unit: 'hours', icon: 'focus', value: c => Math.floor(c.stats.focus_minutes / 60) },
  { id: 'quiz-ace', label: 'Quiz ace', how: 'Finish 5 quiz attempts', target: 5, icon: 'quiz', value: c => c.stats.quizzes_done },
  { id: 'player', label: 'Player', how: 'Play 5 games', target: 5, icon: 'game', value: c => c.stats.games },
  { id: 'curious', label: 'Curious', how: 'Ask the tutor 20 times', target: 20, icon: 'chat', value: c => c.stats.tutor_messages },
  { id: 'streak-3', label: '3-day streak', how: 'Study 3 days in a row', target: 3, unit: 'days', icon: 'flame', value: c => c.bestStreak },
  { id: 'streak-7', label: '7-day streak', how: 'Study 7 days in a row', target: 7, unit: 'days', icon: 'flame', value: c => c.bestStreak },
  { id: 'level-5', label: 'Level 5', how: 'Reach level 5', target: 5, unit: 'level', icon: 'star', value: c => c.level },
]

export type BadgeState = { id: string; label: string; how: string; icon: Def['icon']; target: number; unit: string | null; value: number; earned: boolean }

export function evaluate(c: Ctx): BadgeState[] {
  return BADGES.map(b => {
    const raw = b.value(c)
    return { id: b.id, label: b.label, how: b.how, icon: b.icon, target: b.target, unit: b.unit ?? null, value: Math.min(raw, b.target), earned: raw >= b.target }
  })
}

export const earnedCount = (states: BadgeState[]) => states.filter(b => b.earned).length
