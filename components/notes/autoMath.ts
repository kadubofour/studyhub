import katex from 'katex'

const TRAILING = /[.,;:!?]+$/
// A ^ between a value and what it raises; or a one-letter base with a subscript (a_n, H_2O but not my_var)
const POWER = /[A-Za-z0-9)}\]]\^[A-Za-z0-9{(\\-]/
const SUBSCRIPT = /(?:^|[^A-Za-z_])[A-Za-z]_[A-Za-z0-9{]/
const COMMAND = /\\[A-Za-z]+/

/**
 * If a word the student just typed is maths (x^2, a_n, \frac{a}{b}…), the LaTeX to render and any
 * punctuation that followed it. Only words KaTeX can actually read count, so paths and typos stay text.
 */
export function mathToken(word: string): { latex: string; trailing: string } | null {
  const trailing = word.match(TRAILING)?.[0] ?? ''
  const latex = word.slice(0, word.length - trailing.length)
  if (!latex || /[$`@￼]|:\/\//.test(latex)) return null
  if (!POWER.test(latex) && !SUBSCRIPT.test(latex) && !COMMAND.test(latex)) return null
  try {
    katex.renderToString(latex, { throwOnError: true })
  } catch {
    return null
  }
  return { latex, trailing }
}

/**
 * Markdown editor: when the character just typed (before `cursor`) is a space and the word before
 * it is maths, wrap that word in $…$. Returns the new text and cursor, or null to leave it alone.
 */
export function autoWrapMath(value: string, cursor: number): { value: string; cursor: number } | null {
  if (value[cursor - 1] !== ' ') return null
  const before = value.slice(0, cursor - 1)
  const start = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n'), before.lastIndexOf('\t')) + 1
  const token = mathToken(before.slice(start))
  if (!token) return null
  // Not inside a code block, a $$ block, a `code span` or a $…$ on this line
  const fences = before.split('\n').filter(l => l.trimStart().startsWith('```')).length
  const blocks = (before.match(/\$\$/g) ?? []).length
  const line = before.slice(before.lastIndexOf('\n') + 1, start)
  const ticks = (line.match(/`/g) ?? []).length
  const dollars = (line.replace(/\\\$/g, '').match(/\$/g) ?? []).length
  if (fences % 2 || blocks % 2 || ticks % 2 || dollars % 2) return null
  const wrapped = `$${token.latex}$${token.trailing}`
  return { value: before.slice(0, start) + wrapped + value.slice(cursor - 1), cursor: cursor + 2 }
}
