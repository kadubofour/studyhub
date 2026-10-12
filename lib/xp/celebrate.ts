export type Snapshot = { total: number; level: number }
// The last reading is kept for the session, so leaving a full-screen page (a quiz) and coming back still finds the gain
let lastSeen: Snapshot | null = null
export const seenXp = () => lastSeen
export const rememberXp = (s: Snapshot) => { lastSeen = s }
export const forgetXp = () => { lastSeen = null }

export type Burst = { gained: number; levelUp: number | null }

// What to cheer about when XP is read again: the points gained, and the level if it went up.
// The first reading (null before) is just a page loading, and a drop is not a win.
export function celebrate(before: Snapshot | null, after: Snapshot): Burst | null {
  if (!before || after.total <= before.total) return null
  return { gained: after.total - before.total, levelUp: after.level > before.level ? after.level : null }
}
