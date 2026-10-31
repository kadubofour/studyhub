// Text for the ear. A tutor's reply is written for reading (Markdown, LaTeX); a live session says it aloud, a sentence at a time as it is written,
// and listens meanwhile, so it must tell the student's voice from its own coming back through the microphone.

/** A reply with the marks that are only for the eye taken out, so it can be read aloud */
export function forSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' that equation ')
    .replace(/\$([^$\n]+)\$/g, (_, m: string) => ` ${spokenMath(m)} `)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~`]+/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// A little maths said in words; anything longer than a short expression is better left to the screen
function spokenMath(m: string): string {
  const s = m.replace(/\\(?:left|right)/g, '').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 over $2').replace(/\\sqrt\{([^}]*)\}/g, 'the square root of $1')
    .replace(/\^\{?2\}?/g, ' squared').replace(/\^\{?3\}?/g, ' cubed').replace(/\^\{?([^}\s]+)\}?/g, ' to the power $1')
    .replace(/_\{?([^}\s]+)\}?/g, ' sub $1').replace(/\\cdot|\\times/g, ' times ').replace(/\\(?:leq?|le)\b/g, ' is at most ').replace(/\\(?:geq?|ge)\b/g, ' is at least ')
    .replace(/\\pi\b/g, 'pi').replace(/\\infty\b/g, 'infinity').replace(/\\in\b/g, ' is in ').replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/=/g, ' equals ').replace(/\+/g, ' plus ').replace(/(\w)\s*-\s*(\w)/g, '$1 minus $2').replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim()
  return s.length <= 60 ? s : 'that expression'
}

const ABBREVIATION = /(?:e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|Fig|No)\.$/
const MIN_PIECE = 24

/** The sentences complete in the text so far, and what is left of the last, unfinished one. Short bits join the next, so no audio is a single word. */
export function takeSentences(text: string, final = false): { ready: string[]; rest: string } {
  const pieces: string[] = []
  let start = 0
  // the end of a sentence: . ! or ? followed by a space, or a line break (a decimal point has no space after it)
  const end = /[.!?]+["')\]]*(?=\s)|\n+/g
  for (let m = end.exec(text); m; m = end.exec(text)) {
    const piece = text.slice(start, m.index + m[0].length).trim()
    if (ABBREVIATION.test(piece)) continue // "e.g." does not end it
    if (piece) pieces.push(piece)
    start = m.index + m[0].length
  }
  let rest = text.slice(start).trimStart()
  if (final && rest.trim()) { pieces.push(rest.trim()); rest = '' }
  const ready: string[] = []
  let carry = ''
  for (const p of pieces) {
    const joined = carry ? `${carry} ${p}` : p
    if (joined.length < MIN_PIECE) carry = joined
    else { ready.push(joined); carry = '' }
  }
  if (carry) { if (final) ready.push(carry); else rest = `${carry} ${rest}`.trimStart() }
  return { ready, rest }
}

const wordsOf = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)

/**
 * Whether what the microphone heard is the tutor's own voice coming back (from the speakers) rather than the student: nearly all of the heard
 * words are among those being said. A student speaking over the tutor says other words, so they are not mistaken for it.
 */
export function isEcho(heard: string, saying: string): boolean {
  const h = wordsOf(heard)
  if (!h.length) return true
  const said = new Set(wordsOf(saying))
  if (!said.size) return false
  const inside = h.filter(w => said.has(w)).length
  return inside / h.length >= 0.75
}

/** Words enough that it is speech, not a cough or a click the recogniser guessed at */
export const isSpeech = (heard: string) => wordsOf(heard).length >= 2 || heard.trim().length >= 6
