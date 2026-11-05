// Whether a tutor reply explains something, and so is worth having drawn. Read from the reply's own words, so it costs nothing and works on replies already saved.
// Greetings, confirmations, questions back, quiz questions and plans have the length of an explanation at times, but not its reasoning.

const MIN_WORDS = 35
const SHORT_WITH_PROPOSAL = 80
// The words of someone giving reasons and meanings
const REASONING = [
  /\bbecause\b/, /\bthat means\b|\bthis means\b|\bwhich means\b|\bmeans that\b/, /\btherefore\b|\bthus\b|\bhence\b/, /\bso that\b/, /\bwhich is why\b|\bthat's why\b|\bthis is why\b/,
  /\bfor example\b|\bfor instance\b|\bimagine\b|\bthink of\b/, /\bin other words\b/, /\bis defined as\b|\brefers to\b/, /\bcauses?\b|\bleads? to\b|\bresults? in\b/,
  /\bworks by\b|\bhow it works\b|\bthe idea\b|\bthe reason\b/, /\bcommon mistake\b/, /\bequals\b|\bformula\b|\bequation\b/,
]

export function isExplaining(content: string, proposals = 0): boolean {
  const text = content.trim()
  if (/explain visually/i.test(text)) return true // the tutor has told the student to press it
  const words = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  if (words < MIN_WORDS) return false
  if (proposals > 0 && words < SHORT_WITH_PROPOSAL) return false // it is handing over a note, a quiz or a task
  // a list of questions for the student to answer
  if (text.split('\n').filter(l => /\?\s*\**\s*$/.test(l)).length >= 3) return false
  const lower = text.toLowerCase()
  const reasons = REASONING.filter(r => r.test(lower)).length
  const maths = /\$[^$\n]+\$|\$\$/.test(text)
  return reasons >= 2 || (maths && reasons >= 1)
}
