import JSZip from 'jszip'
import mammoth from 'mammoth'
import TurndownService from 'turndown'
// @ts-expect-error - no type declarations published
import { gfm } from 'turndown-plugin-gfm'
// @ts-expect-error - no type declarations published
import omml2mathml from 'omml2mathml'
import { MathMLToLaTeX } from 'mathml-to-latex'

// Word (.docx) → note Markdown. Word equations (OMML) become LaTeX ($…$ / $$…$$):
// they are swapped for placeholder tokens before mammoth (which drops equations), then restored.

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export interface ImportedNote { title: string; content_md: string }

function ommlToLatex(el: Element): string | null {
  try {
    const mathml = omml2mathml(el) as Element
    const latex = MathMLToLaTeX.convert(mathml.outerHTML).trim()
    return latex || null
  } catch {
    return null
  }
}

async function swapEquations(buf: ArrayBuffer): Promise<{ buf: ArrayBuffer; math: { latex: string; display: boolean }[] }> {
  const zip = await JSZip.loadAsync(buf)
  const file = zip.file('word/document.xml')
  if (!file) return { buf, math: [] }
  const doc = new DOMParser().parseFromString(await file.async('string'), 'application/xml')
  const math: { latex: string; display: boolean }[] = []

  const tokenRun = (text: string) => {
    const r = doc.createElementNS(W_NS, 'w:r')
    const t = doc.createElementNS(W_NS, 'w:t')
    t.setAttribute('xml:space', 'preserve')
    t.textContent = text
    r.appendChild(t)
    return r
  }

  // Display equations first (they contain oMath children), then the remaining inline ones
  for (const para of Array.from(doc.getElementsByTagNameNS(M_NS, 'oMathPara'))) {
    const inner = para.getElementsByTagNameNS(M_NS, 'oMath')[0]
    const latex = inner ? ommlToLatex(inner) : null
    para.parentNode?.replaceChild(tokenRun(latex ? `ZZDMATH${math.length}ZZ` : (para.textContent ?? '')), para)
    if (latex) math.push({ latex, display: true })
  }
  for (const m of Array.from(doc.getElementsByTagNameNS(M_NS, 'oMath'))) {
    const latex = ommlToLatex(m)
    m.parentNode?.replaceChild(tokenRun(latex ? `ZZIMATH${math.length}ZZ` : (m.textContent ?? '')), m)
    if (latex) math.push({ latex, display: false })
  }

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc))
  return { buf: await zip.generateAsync({ type: 'arraybuffer' }), math }
}

function turndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' })
  td.use(gfm)
  // Only escape what would change meaning at the start of a line; keep snake_case and a*b intact
  td.escape = (s: string) => s.replace(/^(#{1,6} |[-+*] |\d+\. |> )/gm, '\\$1')
  return td
}

export async function docxToNote(buf: ArrayBuffer, fileName: string): Promise<ImportedNote> {
  const { buf: swapped, math } = await swapEquations(buf)
  // mammoth's browser build reads an ArrayBuffer; its Node build (tests) needs a Buffer
  const input = typeof window !== 'undefined' && typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined'
    ? { arrayBuffer: swapped }
    : { buffer: Buffer.from(swapped) }
  const { value: html } = await mammoth.convertToHtml(
    input as Parameters<typeof mammoth.convertToHtml>[0],
    { styleMap: ["p[style-name='Title'] => h1.doc-title:fresh"] },
  )

  // The document title (Title style, else the first top-level heading) becomes the note title
  const container = document.createElement('div')
  container.innerHTML = html
  const titleEl = container.querySelector('h1.doc-title') ?? container.querySelector('h1')
  let title = titleEl?.textContent?.trim() ?? ''
  titleEl?.remove()
  if (!title || title === 'Untitled') title = fileName.replace(/\.docx$/i, '').trim() || 'Imported note'

  let md = turndown().turndown(container.innerHTML)
  md = md.replace(/ZZ([DI])MATH(\d+)ZZ/g, (_, kind: string, i: string) => {
    const m = math[Number(i)]
    if (!m) return ''
    return kind === 'D' ? `\n\n$$\n${m.latex}\n$$\n\n` : `$${m.latex}$`
  })
  md = md.replace(/^(\s*)([-*]|\d+\.) {2,}/gm, '$1$2 ') // turndown pads list markers ("-   item")
  return { title, content_md: md.replace(/\n{3,}/g, '\n\n').trim() }
}
