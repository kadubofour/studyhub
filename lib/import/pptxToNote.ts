import JSZip from 'jszip'

export const MAX_SLIDES = 200
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'
// Placeholders that hold furniture, not content
const FURNITURE = new Set(['sldNum', 'sldImg', 'hdr', 'ftr', 'dt'])

// The text paragraphs of a slide or notes page, in order, one string each; empty ones and furniture left out
function paragraphs(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is damaged.')
  const out: string[] = []
  for (const shape of Array.from(doc.getElementsByTagNameNS(P_NS, 'sp'))) {
    const ph = shape.getElementsByTagNameNS(P_NS, 'ph')[0]
    if (ph && FURNITURE.has(ph.getAttribute('type') ?? '')) continue
    for (const p of Array.from(shape.getElementsByTagNameNS(A_NS, 'p'))) {
      const text = Array.from(p.getElementsByTagNameNS(A_NS, 't')).map(t => t.textContent ?? '').join('').replace(/\s+/g, ' ').trim()
      if (text) out.push(text)
    }
  }
  return out
}

// A PowerPoint (.pptx) → note Markdown: a section per slide (its first text is the heading, the rest bullets), with speaker notes.
export async function pptxToNote(buf: ArrayBuffer, fileName: string): Promise<{ title: string; content_md: string; notice?: string }> {
  const zip = await JSZip.loadAsync(buf)
  const numbers = Object.keys(zip.files).map(n => /^ppt\/slides\/slide(\d+)\.xml$/.exec(n)?.[1]).filter((n): n is string => !!n).map(Number).sort((a, b) => a - b)
  if (!numbers.length) throw new Error('This file has no slides.')
  const sections: string[] = []
  let title = ''
  for (const n of numbers.slice(0, MAX_SLIDES)) {
    const [head, ...rest] = paragraphs(await zip.file(`ppt/slides/slide${n}.xml`)!.async('string'))
    if (!title && head) title = head
    const noteFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`)
    const notes = noteFile ? paragraphs(await noteFile.async('string')).join(' ') : ''
    sections.push([`## Slide ${sections.length + 1}${head ? `: ${head}` : ''}`, ...(rest.length ? [rest.map(r => `- ${r}`).join('\n')] : []), ...(notes ? [`*Notes:* ${notes}`] : [])].join('\n\n'))
  }
  return {
    title: title.slice(0, 200) || fileName.replace(/\.[^.]+$/, '').trim() || 'Imported slides',
    content_md: sections.join('\n\n'),
    ...(numbers.length > MAX_SLIDES ? { notice: `Only the first ${MAX_SLIDES} slides were read.` } : {}),
  }
}
