// "Explain this" on text selected in a note: the message the tutor is asked, with the passage quoted and which note it is from.
export const EXPLAIN_MAX = 1500 // characters of the passage; the message as a whole may be 4000

/** The passage as one tidy quote, cut at a word when long */
export function quotePassage(text: string): string {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const cut = clean.length > EXPLAIN_MAX ? `${clean.slice(0, EXPLAIN_MAX).replace(/\s+\S*$/, '')}…` : clean
  return cut.split('\n').map(l => `> ${l}`.trimEnd()).join('\n')
}

export function explainMessage(noteTitle: string, selected: string): string {
  const from = noteTitle.trim() ? ` from my note “${noteTitle.trim().slice(0, 100)}”` : ' from my note'
  return `Explain this${from}, step by step, in simple terms:\n\n${quotePassage(selected)}`
}
