export type TaskType = 'assignment' | 'exam' | 'reading' | 'other'
export type Priority = 'low' | 'normal' | 'high'
export type ClassKind = 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'other'
export type EditorMode = 'rich' | 'markdown'
export type ThemePref = 'light' | 'dark' | 'system'

export interface Profile {
  id: string
  display_name: string | null
  timezone: string
  daily_goal_minutes: number
  focus_minutes: number
  short_break_minutes: number
  long_break_minutes: number
  long_break_every: number
  default_editor_mode: EditorMode
  theme: ThemePref
  onboarded: boolean
}
export interface Course { id: string; name: string; color: string }
export interface Task {
  id: string; course_id: string | null; title: string; type: TaskType
  due_at: string | null; priority: Priority; done_at: string | null; created_at: string
}
export interface ClassSlot {
  id: string; course_id: string; day_of_week: number; start_time: string; end_time: string
  location: string | null; kind: ClassKind
}
export interface NoteSummary { id: string; course_id: string | null; title: string; updated_at: string }
export interface Note extends NoteSummary { content_md: string }
export interface Deck { id: string; course_id: string | null; name: string }
export interface DeckWithDue extends Deck { due: number; total: number }
export interface Card {
  id: string; deck_id: string; front: string; back: string; due_at: string
  interval_days: number; ease: number; reps: number; lapses: number
}
export interface Review { id: string; card_id: string; rating: 1 | 2 | 3 | 4; reviewed_at: string }
export interface FocusSession { id: string; started_at: string; ended_at: string; minutes: number; completed: boolean }
