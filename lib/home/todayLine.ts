const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// The line under Home's greeting: today's one fact, in words. What is overdue comes first, since it needs doing first.
export function todayLine({ overdue, dueToday, reminders }: { overdue: number; dueToday: number; reminders: number }): string {
  const parts: string[] = []
  if (overdue) parts.push(count(overdue, 'overdue task', 'overdue tasks'))
  if (dueToday) parts.push(overdue ? `${dueToday} due today` : `${count(dueToday, 'task', 'tasks')} due today`)
  if (reminders) parts.push(parts.length ? count(reminders, 'reminder', 'reminders') : `${count(reminders, 'reminder', 'reminders')} today`)
  if (parts.length === 0) return 'Nothing due today.'
  const last = parts.pop()!
  return `${parts.length ? `${parts.join(', ')} and ${last}` : last}.`
}
