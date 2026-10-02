import katex from 'katex'

// LaTeX → (KaTeX) MathML → Office Math (OMML), the format Word uses for real, editable equations.
// Covers what students write: scripts, fractions, roots, sums/integrals, accents, matrices.
// Returns null when KaTeX can't parse the LaTeX, so the caller can fall back to plain text.

const NARY = new Set(['∑', '∏', '∐', '∫', '∬', '∭', '∮', '∯', '∰', '⋃', '⋂', '⋁', '⋀', '⨁', '⨂'])
const INTEGRALS = new Set(['∫', '∬', '∭', '∮', '∯', '∰'])

// Characters XML 1.0 forbids (Word refuses a file containing them) are dropped
export const stripControl = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
const esc = (s: string) => stripControl(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const el = (children: Element) => Array.from(children.children)

// sty: p = upright, b = bold, bi = bold italic; undefined = Word's default italic math
function run(text: string, sty?: 'p' | 'b' | 'bi'): string {
  // Whitespace-only text is dropped by the docx writer, so spacing becomes visible space characters
  if (text !== '' && text.trim() === '') text = '\u2009' // thin space
  const rPr = sty ? `<m:rPr><m:sty m:val="${sty}"/></m:rPr>` : ''
  return `<m:r>${rPr}<m:t xml:space="preserve">${esc(text)}</m:t></m:r>`
}

function styOf(variant: string | null, fallbackPlain: boolean): 'p' | 'b' | 'bi' | undefined {
  if (variant === 'bold') return 'b'
  if (variant === 'bold-italic') return 'bi'
  if (variant === 'normal' || fallbackPlain) return 'p'
  return undefined
}

const isFence = (n: Element | undefined) => n?.localName === 'mo' && n.getAttribute('fence') === 'true'

// A big operator with limits (∑, ∫ …): base element is <mo> holding the operator
function naryOf(node: Element): { chr: string; sub: Element | null; sup: Element | null } | null {
  const tag = node.localName
  if (!['munderover', 'munder', 'mover', 'msubsup', 'msub', 'msup'].includes(tag)) return null
  const [base, a, b] = el(node)
  const chr = base?.localName === 'mo' ? (base.textContent ?? '').trim() : ''
  if (!NARY.has(chr)) return null
  if (tag === 'munderover' || tag === 'msubsup') return { chr, sub: a ?? null, sup: b ?? null }
  if (tag === 'munder' || tag === 'msub') return { chr, sub: a ?? null, sup: null }
  return { chr, sub: null, sup: a ?? null }
}

function nary(n: { chr: string; sub: Element | null; sup: Element | null }, body: string): string {
  const pr = `<m:naryPr><m:chr m:val="${esc(n.chr)}"/><m:limLoc m:val="${INTEGRALS.has(n.chr) ? 'subSup' : 'undOvr'}"/>`
    + (n.sub ? '' : '<m:subHide m:val="1"/>') + (n.sup ? '' : '<m:supHide m:val="1"/>') + '</m:naryPr>'
  return `<m:nary>${pr}<m:sub>${n.sub ? conv(n.sub) : ''}</m:sub><m:sup>${n.sup ? conv(n.sup) : ''}</m:sup><m:e>${body}</m:e></m:nary>`
}

// Children in sequence; a big operator absorbs the element right after it as its body
function seq(children: Element[]): string {
  let out = ''
  for (let i = 0; i < children.length; i++) {
    const n = naryOf(children[i])
    if (n) {
      const next = children[i + 1]
      out += nary(n, next ? conv(next) : '')
      if (next) i++
    } else {
      out += conv(children[i])
    }
  }
  return out
}

function conv(node: Element): string {
  const kids = el(node)
  switch (node.localName) {
    case 'mrow': {
      // \left( … \right) and cases: fence operators at both ends → a delimiter that stretches
      // (cases has only an opening brace)
      if (kids.length >= 2 && isFence(kids[0])) {
        const closed = isFence(kids[kids.length - 1])
        const beg = (kids[0].textContent ?? '').trim()
        const end = closed ? (kids[kids.length - 1].textContent ?? '').trim() : ''
        return `<m:d><m:dPr><m:begChr m:val="${esc(beg)}"/><m:endChr m:val="${esc(end)}"/></m:dPr><m:e>${seq(kids.slice(1, closed ? -1 : undefined))}</m:e></m:d>`
      }
      return seq(kids)
    }
    case 'menclose': {
      const notation = node.getAttribute('notation') ?? ''
      if (/strike/.test(notation)) {
        const strike = notation.includes('downdiagonal') ? 'strikeTLBR' : notation.includes('horizontal') ? 'strikeH' : 'strikeBLTR'
        return `<m:borderBox><m:borderBoxPr><m:hideTop m:val="1"/><m:hideBot m:val="1"/><m:hideLeft m:val="1"/><m:hideRight m:val="1"/><m:${strike} m:val="1"/></m:borderBoxPr><m:e>${seq(kids)}</m:e></m:borderBox>`
      }
      if (notation.includes('box')) return `<m:borderBox><m:e>${seq(kids)}</m:e></m:borderBox>`
      return seq(kids)
    }
    case 'math': case 'mstyle': case 'mpadded': case 'mfenced': case 'mtd':
      return seq(kids)
    case 'semantics':
      return kids[0] ? conv(kids[0]) : '' // skip the <annotation> with the source LaTeX
    case 'annotation': case 'annotation-xml': case 'mphantom':
      return ''
    case 'mi': {
      const t = node.textContent ?? ''
      return run(t, styOf(node.getAttribute('mathvariant'), t.length > 1))
    }
    case 'mn': case 'mo': case 'mtext': case 'ms':
      return run(node.textContent ?? '', styOf(node.getAttribute('mathvariant'), true) ?? 'p')
    case 'mspace': {
      const em = parseFloat(node.getAttribute('width') ?? '0')
      return run(em >= 1 ? '\u2003' : em >= 0.25 ? '\u2005' : '\u2009', 'p') // em / four-per-em / thin space
    }
    case 'msup': {
      const n = naryOf(node); if (n) return nary(n, '')
      return `<m:sSup><m:e>${conv(kids[0])}</m:e><m:sup>${conv(kids[1])}</m:sup></m:sSup>`
    }
    case 'msub': {
      const n = naryOf(node); if (n) return nary(n, '')
      return `<m:sSub><m:e>${conv(kids[0])}</m:e><m:sub>${conv(kids[1])}</m:sub></m:sSub>`
    }
    case 'msubsup': {
      const n = naryOf(node); if (n) return nary(n, '')
      return `<m:sSubSup><m:e>${conv(kids[0])}</m:e><m:sub>${conv(kids[1])}</m:sub><m:sup>${conv(kids[2])}</m:sup></m:sSubSup>`
    }
    case 'mfrac': {
      const noBar = node.getAttribute('linethickness') === '0' || node.getAttribute('linethickness') === '0px'
      return `<m:f>${noBar ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : ''}<m:num>${conv(kids[0])}</m:num><m:den>${conv(kids[1])}</m:den></m:f>`
    }
    case 'msqrt':
      return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${seq(kids)}</m:e></m:rad>`
    case 'mroot':
      return `<m:rad><m:deg>${conv(kids[1])}</m:deg><m:e>${conv(kids[0])}</m:e></m:rad>`
    case 'mover': {
      if (node.getAttribute('accent') === 'true') {
        const chr = (kids[1]?.textContent ?? '').trim()
        return `<m:acc><m:accPr><m:chr m:val="${esc(chr)}"/></m:accPr><m:e>${conv(kids[0])}</m:e></m:acc>`
      }
      return `<m:limUpp><m:e>${conv(kids[0])}</m:e><m:lim>${conv(kids[1])}</m:lim></m:limUpp>`
    }
    case 'munder':
      return `<m:limLow><m:e>${conv(kids[0])}</m:e><m:lim>${conv(kids[1])}</m:lim></m:limLow>`
    case 'munderover':
      return `<m:limUpp><m:e><m:limLow><m:e>${conv(kids[0])}</m:e><m:lim>${conv(kids[1])}</m:lim></m:limLow></m:e><m:lim>${conv(kids[2])}</m:lim></m:limUpp>`
    case 'mtable':
      // aligned/align environments (right-left column pairs) → an equation array, one row per line
      if (/^right left/.test(node.getAttribute('columnalign') ?? '')) {
        return `<m:eqArr>${kids.map(tr => `<m:e>${el(tr).map(td => conv(td)).join('')}</m:e>`).join('')}</m:eqArr>`
      }
      return `<m:m>${kids.map(tr => `<m:mr>${el(tr).map(td => `<m:e>${conv(td)}</m:e>`).join('')}</m:mr>`).join('')}</m:m>`
    default:
      return seq(kids)
  }
}

export function latexToOmml(latex: string, display: boolean): string | null {
  latex = stripControl(latex)
  let html: string
  try {
    html = katex.renderToString(latex, { output: 'mathml', displayMode: display, throwOnError: true })
  } catch {
    return null
  }
  const mathml = html.match(/<math[\s\S]*<\/math>/)?.[0]
  if (!mathml) return null
  const doc = new DOMParser().parseFromString(mathml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return null
  const body = conv(doc.documentElement)
  return display ? `<m:oMathPara><m:oMath>${body}</m:oMath></m:oMathPara>` : `<m:oMath>${body}</m:oMath>`
}
