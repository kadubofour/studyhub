import JSZip from 'jszip'
import { mediaType, type KeepPicture } from './pictures'

export const MAX_SLIDES = 200
export const MAX_PPTX_BYTES = 100 * 1024 * 1024
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
// Placeholders that hold furniture, not content
const FURNITURE = new Set(['sldNum', 'sldImg', 'hdr', 'ftr', 'dt'])

// a picture is found by its relationship id, then stored and written as Markdown (md) before the slide is written out
type Item = { kind: 'text'; text: string } | { kind: 'table'; rows: string[][] } | { kind: 'pic'; rid: string; alt: string } | { kind: 'md'; md: string }
type Content = { title: string; items: Item[] }

const parse = (xml: string): Document => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is damaged.')
  return doc
}
const kids = (el: Element) => Array.from(el.children)
const local = (el: Element) => el.localName

// A paragraph's words: runs and fields, a line break counting as a space
function paragraphText(p: Element): string {
  let out = ''
  for (const c of kids(p)) {
    if (local(c) === 'br') out += ' '
    else if (local(c) === 'r' || local(c) === 'fld') out += Array.from(c.getElementsByTagNameNS(A_NS, 't')).map(t => t.textContent ?? '').join('')
  }
  return out.replace(/\s+/g, ' ').trim()
}
const paragraphsOf = (el: Element) => Array.from(el.getElementsByTagNameNS(A_NS, 'p')).map(paragraphText).filter(Boolean)

// The content of a slide or notes page in reading order: text boxes, tables and grouped shapes
function readTree(tree: Element, out: Content) {
  for (const node of kids(tree)) {
    if (local(node) === 'grpSp') readTree(node, out)
    else if (local(node) === 'sp') {
      const ph = node.getElementsByTagNameNS(P_NS, 'ph')[0]
      const type = ph?.getAttribute('type') ?? ''
      if (FURNITURE.has(type)) continue
      const paras = paragraphsOf(node)
      if (type === 'title' || type === 'ctrTitle') out.title = [out.title, ...paras].filter(Boolean).join(' ')
      else for (const text of paras) out.items.push({ kind: 'text', text })
    } else if (local(node) === 'pic') {
      const rid = node.getElementsByTagNameNS(A_NS, 'blip')[0]?.getAttributeNS(R_NS, 'embed')
      const alt = node.getElementsByTagNameNS(P_NS, 'cNvPr')[0]?.getAttribute('descr') ?? ''
      if (rid) out.items.push({ kind: 'pic', rid, alt })
    } else if (local(node) === 'graphicFrame') {
      const tbl = node.getElementsByTagNameNS(A_NS, 'tbl')[0]
      if (!tbl) continue
      const rows = Array.from(tbl.getElementsByTagNameNS(A_NS, 'tr')).map(tr => Array.from(tr.getElementsByTagNameNS(A_NS, 'tc')).map(tc => paragraphsOf(tc).join(' ')))
      if (rows.some(r => r.some(Boolean))) out.items.push({ kind: 'table', rows })
    }
  }
}
function content(xml: string, notes = false): Content {
  const tree = parse(xml).getElementsByTagNameNS(P_NS, 'spTree')[0]
  const out: Content = { title: '', items: [] }
  if (tree) readTree(tree, out)
  if (!notes && !out.title) { // no title placeholder: the first text is the heading
    const first = out.items.findIndex(i => i.kind === 'text')
    if (first >= 0) out.title = (out.items.splice(first, 1)[0] as { text: string }).text
  }
  return out
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
function tableMd(rows: string[][]): string {
  const width = Math.max(...rows.map(r => r.length))
  const pad = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? '')).join(' | ')} |`
  return [pad(rows[0]), `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map(pad)].join('\n')
}
function itemsMd(items: Item[]): string[] {
  const out: string[] = []
  let bullets: string[] = []
  const flush = () => { if (bullets.length) out.push(bullets.join('\n')); bullets = [] }
  for (const i of items) {
    if (i.kind === 'text') bullets.push(`- ${i.text}`)
    else if (i.kind === 'table') { flush(); out.push(tableMd(i.rows)) }
    else if (i.kind === 'md') { flush(); out.push(i.md) }
  }
  flush()
  return out
}

// "ppt/slides/_rels/slide2.xml.rels" Target "../notesSlides/notesSlide1.xml" → "ppt/notesSlides/notesSlide1.xml"
function resolve(fromDir: string, target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : `${fromDir}/${target}`).split('/')
  const out: string[] = []
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p) }
  return out.join('/')
}
async function relationships(zip: JSZip, path: string): Promise<{ id: string; type: string; target: string }[]> {
  const f = zip.file(path)
  if (!f) return []
  return Array.from(parse(await f.async('string')).getElementsByTagName('Relationship')).map(r => ({ id: r.getAttribute('Id') ?? '', type: r.getAttribute('Type') ?? '', target: r.getAttribute('Target') ?? '' }))
}

// Slides in the order of the presentation; the file numbers when that list can't be read
async function slideFiles(zip: JSZip): Promise<string[]> {
  const byNumber = Object.keys(zip.files).map(n => ({ n, num: /^ppt\/slides\/slide(\d+)\.xml$/.exec(n)?.[1] })).filter(x => x.num).sort((a, b) => Number(a.num) - Number(b.num)).map(x => x.n)
  try {
    const pres = zip.file('ppt/presentation.xml')
    if (!pres) return byNumber
    const rels = new Map((await relationships(zip, 'ppt/_rels/presentation.xml.rels')).map(r => [r.id, resolve('ppt', r.target)]))
    const ordered = Array.from(parse(await pres.async('string')).getElementsByTagNameNS(P_NS, 'sldId'))
      .map(s => rels.get(s.getAttributeNS(R_NS, 'id') ?? '')).filter((p): p is string => !!p && !!zip.file(p))
    return ordered.length ? ordered : byNumber
  } catch { return byNumber }
}

// A PowerPoint (.pptx) → note Markdown: a section per slide (its title is the heading, the rest bullets and tables), with speaker notes.
// keep: stores each picture on a slide and gives back its Markdown; without it pictures are left out, as before
export async function pptxToNote(buf: ArrayBuffer, fileName: string, keep?: KeepPicture): Promise<{ title: string; content_md: string; notice?: string }> {
  if (buf.byteLength > MAX_PPTX_BYTES) throw new Error('Slides can be up to 100 MB.')
  const zip = await JSZip.loadAsync(buf)
  const files = await slideFiles(zip)
  if (!files.length) throw new Error('This file has no slides.')
  const sections: string[] = []
  let title = ''
  let unreadable = 0
  const hasRels = Object.keys(zip.files).some(n => n.startsWith('ppt/slides/_rels/'))
  for (const path of files.slice(0, MAX_SLIDES)) {
    try {
      const c = content(await zip.file(path)!.async('string'))
      const dir = path.slice(0, path.lastIndexOf('/'))
      const name = path.slice(path.lastIndexOf('/') + 1)
      const rels = await relationships(zip, `${dir}/_rels/${name}.rels`)
      const noteRel = rels.find(r => /\/notesSlide$/.test(r.type))
      // A deck with no relationship lists at all is read by number; otherwise a slide with no link has no notes
      const notePath = noteRel ? resolve(dir, noteRel.target) : hasRels ? '' : `ppt/notesSlides/notesSlide${/slide(\d+)\.xml$/.exec(name)?.[1]}.xml`
      const noteFile = notePath ? zip.file(notePath) : null
      const notes = noteFile ? content(await noteFile.async('string'), true).items.map(i => (i.kind === 'text' ? i.text : '')).filter(Boolean).join(' ') : ''
      // the slide's pictures, from its own relationships, in place among its text
      for (let k = 0; k < c.items.length; k++) {
        const it = c.items[k]
        if (it.kind !== 'pic') continue
        const rel = rels.find(r => r.id === it.rid && /\/image$/.test(r.type))
        const media = rel && keep ? zip.file(resolve(dir, rel.target)) : null
        const md = media ? await keep!(new Blob([await media.async('arraybuffer')], { type: mediaType(rel!.target) }), it.alt).catch(() => null) : null
        c.items[k] = md ? { kind: 'md', md } : { kind: 'text', text: '' }
      }
      c.items = c.items.filter(i => i.kind !== 'text' || i.text)
      if (!title && c.title) title = c.title
      sections.push([`## Slide ${sections.length + 1}${c.title ? `: ${c.title}` : ''}`, ...itemsMd(c.items), ...(notes ? [`*Notes:* ${notes}`] : [])].join('\n\n'))
    } catch { unreadable++ }
  }
  if (!sections.length) throw new Error('This file could not be read.')
  const notices = [
    ...(files.length > MAX_SLIDES ? [`Only the first ${MAX_SLIDES} slides were read.`] : []),
    ...(unreadable ? [`${unreadable} slide${unreadable === 1 ? '' : 's'} could not be read.`] : []),
  ]
  return { title: title.slice(0, 200) || fileName.replace(/\.[^.]+$/, '').trim() || 'Imported slides', content_md: sections.join('\n\n'), ...(notices.length ? { notice: notices.join(' ') } : {}) }
}
