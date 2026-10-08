export const MAX_TOPICS = 40
export const MAX_NAME = 80

// What would stop a list being saved, in words a student can act on; null when it is fine
export function validateTopics(list: { name: string }[]): string | null {
  if (list.length > MAX_TOPICS) return `A course can have at most ${MAX_TOPICS} topics.`
  const seen = new Set<string>()
  for (const t of list) {
    const name = t.name.trim()
    if (!name) return 'Every topic needs a name.'
    if (name.length > MAX_NAME) return `Topic names can be at most ${MAX_NAME} characters.`
    const key = name.toLowerCase()
    if (seen.has(key)) return 'Two topics have the same name.'
    seen.add(key)
  }
  return null
}
