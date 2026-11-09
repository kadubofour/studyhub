const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** The course a message names ("teach me math 121", "the Biology notes"): the one whose whole name is in it, the longest if several. Names under 3 letters are not matched. */
export function courseNamed<T extends { id: string; name: string }>(message: string, courses: T[]): T | null {
  const said = ` ${plain(message)} `
  let best: T | null = null
  for (const c of courses) {
    const name = plain(c.name)
    if (name.length < 3 || !said.includes(` ${name} `)) continue
    if (!best || name.length > plain(best.name).length) best = c
  }
  return best
}
