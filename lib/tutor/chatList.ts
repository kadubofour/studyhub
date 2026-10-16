import type { TutorChat } from '@/lib/data/tutor'

export interface ChatContext { kind: 'note' | 'lecture'; title: string }

/** The chats that match what the student typed (in the title, or in the title of the note or lecture it is about) and the course they picked, newest first */
export function filterChats(chats: TutorChat[], contexts: Record<string, ChatContext>, courseId: string | null, query: string): TutorChat[] {
  const q = query.trim().toLowerCase()
  return chats
    .filter(c => (courseId === null || c.course_id === courseId)
      && (!q || c.title.toLowerCase().includes(q) || (contexts[c.id]?.title ?? '').toLowerCase().includes(q)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

/** What the chat is about, in words: "Note: Krebs cycle" or "Lecture: …", or nothing (the course is shown beside it) */
export function aboutLine(context: ChatContext | undefined): string | null {
  return context ? `${context.kind === 'note' ? 'Note' : 'Lecture'}: ${context.title}` : null
}
