import { BarChart3, CalendarDays, FolderOpen, Home, Layers, ListChecks, MessagesSquare, Mic, NotebookPen, Timer, Trophy, type LucideIcon } from 'lucide-react'

// The places in the app, in the order the rail shows them. The palette lists them too, with words they can also be found by.
// Home and Planner stand alone; Library is where everything the student has (notes, notebooks, decks, lectures, quizzes, files) lives,
// and the places that follow are what they do with it (Study, Track), under a heading each. Practice is the page of flashcards and quizzes, at /flashcards.
export interface Place { href: string; label: string; icon: LucideIcon; keywords?: string; alias?: string; group?: 'Study' | 'Track' }
export const PLACES: Place[] = [
  { href: '/home', label: 'Home', icon: Home, keywords: 'today dashboard start' },
  { href: '/planner', label: 'Planner', icon: CalendarDays, keywords: 'tasks calendar exams timetable classes week reminders' },
  { href: '/library', label: 'Library', icon: FolderOpen, keywords: 'everything notes notebooks lectures recordings files material uploads write record' },
  { href: '/flashcards', label: 'Practice', icon: Layers, group: 'Study', alias: 'Flashcards Quizzes', keywords: 'cards decks review quiz test questions' },
  { href: '/tutor', label: 'Tutor', icon: MessagesSquare, group: 'Study', keywords: 'ai chat ask help' },
  { href: '/focus', label: 'Focus', icon: Timer, group: 'Study', keywords: 'timer pomodoro study session sounds' },
  { href: '/progress', label: 'Progress', icon: BarChart3, group: 'Track', keywords: 'stats streak xp level topics' },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, group: 'Track', keywords: 'friends groups rank xp' },
]
// Places the rail does not show but the palette knows
export const MORE_PLACES: Place[] = [
  { href: '/notes', label: 'Notes', icon: NotebookPen, keywords: 'notebooks write' },
  { href: '/lectures', label: 'Lectures', icon: Mic, keywords: 'record recordings transcript audio' },
  { href: '/quiz', label: 'Quiz', icon: ListChecks, keywords: 'test questions quizzes scores' },
  { href: '/courses', label: 'Courses', icon: FolderOpen, keywords: 'subjects modules' },
  { href: '/settings', label: 'Settings', icon: FolderOpen, keywords: 'preferences appearance accent font reminders account' },
  { href: '/profile', label: 'Profile', icon: FolderOpen, keywords: 'me account avatar' },
  { href: '/review', label: 'Review cards', icon: Layers, keywords: 'due flashcards spaced repetition' },
]
// A phone's dock: five places, the first DOCK_SPLIT before Create and the rest after it
export const DOCK = ['/home', '/planner', '/library', '/flashcards', '/tutor']
export const DOCK_SPLIT = 3

// Library is lit for everything inside it (a note, a notebook, a lecture, a file); Flashcards for its reviews and for Quiz
const INSIDE_LIBRARY = ['/notes', '/notebooks', '/lectures', '/files']
export const isActive = (path: string, href: string) =>
  path === href || path.startsWith(href + '/')
  || (href === '/flashcards' && (path.startsWith('/review') || path.startsWith('/quiz')))
  || (href === '/library' && INSIDE_LIBRARY.some(p => path === p || path.startsWith(p + '/')))
