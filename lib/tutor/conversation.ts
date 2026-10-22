// Small, pure helpers for reading a tutor conversation: where the page is scrolled, when a message was sent, and the chat as plain text.

/** True when the end of the conversation (its position down the page) is in view, or just below it: a student reading the newest text is followed */
export function nearBottom({ scrollY, viewport, endY }: { scrollY: number; viewport: number; endY: number }, slack = 120): boolean {
  return scrollY + viewport >= endY - slack
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "Today", "Yesterday", or the date (with the year when it is not this year); nothing for a message with no time yet */
export function dayHeading(iso: string, now: Date): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  if (sameDay(d, now)) return 'Today'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The time of day a message was sent, in the student's own clock; nothing for a message with no time yet */
export function timeOf(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** A question as text, with the names of the files that came with it */
export function questionText(m: { content: string; attachments?: { name: string }[] }): string {
  const names = (m.attachments ?? []).map(a => a.name)
  return names.length ? `${m.content}${m.content ? '\n' : ''}(Attached: ${names.join(', ')})` : m.content
}

/** The whole conversation as plain text, to copy: the title, then each turn as "You:" or "Tutor:" */
export function transcript(title: string, messages: { id: string; role: 'user' | 'assistant'; content: string; status: string; attachments?: { name: string }[] }[]): string {
  const turns = messages.filter(m => m.id !== 'pending').map(m => `${m.role === 'user' ? 'You' : 'Tutor'}: ${questionText(m)}${m.status === 'cut_off' ? ' (cut off)' : ''}`)
  return [title, ...turns].join('\n\n')
}
