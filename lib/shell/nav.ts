import { BarChart3, CalendarDays, FolderOpen, Home, Layers, ListChecks, MessagesSquare, Mic, NotebookPen, Timer, Trophy, type LucideIcon } from 'lucide-react'

// The places in the app, in the order the rail shows them. The palette lists them too, with words they can also be found by.
export interface Place { href: string; label: string; icon: LucideIcon; keywords?: string }
export const PLACES: Place[] = [
  { href: '/home', label: 'Home', icon: Home, keywords: 'today dashboard start' },
  { href: '/planner', label: 'Planner', icon: CalendarDays, keywords: 'tasks calendar exams timetable classes week reminders' },
  { href: '/focus', label: 'Focus', icon: Timer, keywords: 'timer pomodoro study session sounds' },
  { href: '/notes', label: 'Notes', icon: NotebookPen, keywords: 'notebooks write' },
  { href: '/flashcards', label: 'Flashcards', icon: Layers, keywords: 'cards decks review' },
  { href: '/lectures', label: 'Lectures', icon: Mic, keywords: 'record recordings transcript audio' },
  { href: '/tutor', label: 'Tutor', icon: MessagesSquare, keywords: 'ai chat ask help' },
  { href: '/quiz', label: 'Quiz', icon: ListChecks, keywords: 'test questions quizzes' },
  { href: '/library', label: 'Library', icon: FolderOpen, keywords: 'everything files material' },
  { href: '/progress', label: 'Progress', icon: BarChart3, keywords: 'stats streak xp level topics' },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, keywords: 'friends groups rank xp' },
]
// Places the rail does not show but the palette knows
export const MORE_PLACES: Place[] = [
  { href: '/courses', label: 'Courses', icon: FolderOpen, keywords: 'subjects modules' },
  { href: '/settings', label: 'Settings', icon: FolderOpen, keywords: 'preferences appearance accent font reminders account' },
  { href: '/profile', label: 'Profile', icon: FolderOpen, keywords: 'me account avatar' },
  { href: '/review', label: 'Review cards', icon: Layers, keywords: 'due flashcards spaced repetition' },
]
// A phone's dock: four places, with Create in the middle
export const DOCK = ['/home', '/planner', '/notes', '/flashcards']

export const isActive = (path: string, href: string) => path === href || path.startsWith(href + '/') || (href === '/flashcards' && path.startsWith('/review')) || (href === '/notes' && path.startsWith('/notebooks/'))
