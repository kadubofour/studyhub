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

// Escape Word text so it reads the same in Markdown: "$5" mustn't become math, "2*3*4" italics,
// "[x](y)" a link or "<b>" HTML. Underscores inside words (snake_case) are left alone.
export function escapeMarkdownText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/([$`*[\]<>~|])/g, '\\$1')
    .replace(/(^|[^\p{L}\p{N}])_|_(?=[^\p{L}\p{N}]|$)/gu, m => m.replace('_', '\\_'))
    .replace(/^(#{1,6} |[-+] |\d+\. )/gm, '\\$1')
}

function turndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' })
  td.use(gfm)
  td.escape = escapeMarkdownText
  // Images aren't imported (they would bloat the note); leave a readable marker
  td.addRule('image', {
    filter: 'img',
    replacement: (_content, node) => `*[Image${(node as HTMLImageElement).alt ? `: ${(node as HTMLImageElement).alt}` : ''}]*`,
  })
  return td
}

// Tables are converted here rather than by turndown's table plugin, which keeps mammoth's
// per-cell <p> line breaks and doesn't escape "|". Each table becomes a GFM table on one line
// per row (first row = header), swapped in after turndown via a placeholder token.
function extractTables(root: HTMLElement, td: TurndownService): string[] {
  const tables: string[] = []
  for (const table of Array.from(root.querySelectorAll('table'))) {
    const rows = Array.from(table.querySelectorAll('tr')).map((tr, r) => Array.from(tr.querySelectorAll('td, th')).map(cell => {
      const html = Array.from(cell.querySelectorAll('p')).map(p => p.innerHTML.trim()).filter(Boolean).join(' ') || cell.innerHTML
      let text = td.turndown(html).replace(/\s*\n+\s*/g, ' ').trim()
      if (r === 0) text = text.replace(/^\*\*(.+)\*\*$/, '$1') // header cells are bold anyway
      return text
    }))
    if (!rows.length) { table.remove(); continue }
    const width = Math.max(...rows.map(r => r.length))
    const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`
    tables.push([line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n'))
    const marker = root.ownerDocument.createElement('p')
    marker.textContent = `ZZTABLE${tables.length - 1}ZZ`
    table.replaceWith(marker)
  }
  return tables
}

export async function docxToNote(buf: ArrayBuffer, fileName: string): Promise<ImportedNote> {
  const { buf: swapped, math } = await swapEquations(buf)
  // mammoth's browser build reads an ArrayBuffer; its Node build (tests) needs a Buffer
  const input = typeof window !== 'undefined' && typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined'
    ? { arrayBuffer: swapped }
    : { buffer: Buffer.from(swapped) }
  const { value: html } = await mammoth.convertToHtml(
    input as Parameters<typeof mammoth.convertToHtml>[0],
    {
      styleMap: ["p[style-name='Title'] => h1.doc-title:fresh"],
      // Don't embed images as huge base64 data URIs in the note
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    },
  )

  // Only a Title-style paragraph becomes the note title; otherwise the file name is used, so
  // documents that use Heading 1 for every section keep all their headings
  const container = document.createElement('div')
  container.innerHTML = html
  const titleEl = container.querySelector('h1.doc-title')
  let title = titleEl?.textContent?.trim() ?? ''
  titleEl?.remove()
  if (!title || title === 'Untitled') title = fileName.replace(/\.docx$/i, '').trim() || 'Imported note'
  const td = turndown()
  const tables = extractTables(container, td)

  let md = td.turndown(container.innerHTML)
  md = md.replace(/ZZTABLE(\d+)ZZ/g, (_, i: string) => tables[Number(i)] ?? '')
  md = md.replace(/ZZ([DI])MATH(\d+)ZZ/g, (_, kind: string, i: string) => {
    const m = math[Number(i)]
    if (!m) return ''
    return kind === 'D' ? `\n\n$$\n${m.latex}\n$$\n\n` : `$${m.latex}$`
  })
  md = md.replace(/^(\s*)([-*]|\d+\.) {2,}/gm, '$1$2 ') // turndown pads list markers ("-   item")
  return { title, content_md: md.replace(/\n{3,}/g, '\n\n').trim() }
}
