// A tutor reply as words to say: the Markdown marks, links, code fences and tables' lines go; simple maths is said in words.
// Long replies are cut into pieces at sentence ends, because some browsers stop reading a single long piece part way.

const MATH_WORDS: [RegExp, string][] = [
  [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 over $2'],
  [/\\sqrt\{([^{}]*)\}/g, 'the square root of $1'],
  [/\^\{?2\}?/g, ' squared'],
  [/\^\{?3\}?/g, ' cubed'],
  [/\^\{([^{}]*)\}/g, ' to the power of $1'],
  [/\^(\w)/g, ' to the power of $1'],
  [/_\{([^{}]*)\}/g, ' $1'],
  [/\\times|\\cdot/g, ' times '],
  [/\\div/g, ' divided by '],
  [/\\pm/g, ' plus or minus '],
  [/\\leq?|≤/g, ' is at most '],
  [/\\geq?|≥/g, ' is at least '],
  [/\\neq|≠/g, ' is not '],
  [/\\approx|≈/g, ' is about '],
  [/\\(alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|Delta|Sigma|Omega)/g, ' $1 '],
  [/\\[a-zA-Z]+/g, ' '],
  [/[{}]/g, ''],
]
const sayMath = (m: string) => MATH_WORDS.reduce((s, [re, to]) => s.replace(re, to), m).replace(/\s+/g, ' ').trim()

export function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' (a code example) ')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, x: string) => ` ${sayMath(x)}. `)
    .replace(/\$([^$\n]+?)\$/g, (_m, x: string) => sayMath(x))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')       // a table's line under its heading
    .replace(/\|/g, ', ')
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, '$1.')   // headings end like sentences
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')    // list marks
    .replace(/^\s*>\s?/gm, '')
    .replace(/(\*\*|__|\*|_|~~|==)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/_\((.*?)\)_/g, '$1')
    .replace(/\.\.+/g, '.')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

// Pieces of at most about `max` characters, cut after a sentence (or, failing that, at a space)
export function speechChunks(text: string, max = 220): string[] {
  const sentences = text.split(/(?<=[.!?:;])\s+|\n+/).map(s => s.trim()).filter(Boolean)
  const out: string[] = []
  let cur = ''
  const push = (s: string) => { if (s) out.push(s) }
  for (let s of sentences) {
    while (s.length > max) {
      const cut = s.lastIndexOf(' ', max) > 0 ? s.lastIndexOf(' ', max) : max
      push(cur); cur = ''
      push(s.slice(0, cut).trim()); s = s.slice(cut).trim()
    }
    if (cur && cur.length + 1 + s.length > max) { push(cur); cur = s } else cur = cur ? `${cur} ${s}` : s
  }
  push(cur)
  return out
}
