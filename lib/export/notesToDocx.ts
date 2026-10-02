import {
  AlignmentType, Document, ExternalHyperlink, HeadingLevel, ImportedXmlComponent, LevelFormat, Packer, PageBreak,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, type ParagraphChild,
} from 'docx'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Root, RootContent, PhrasingContent, List } from 'mdast'
import { latexToOmml, stripControl } from './mathToOmml'

export interface ExportNote { title: string; course: string | null; content_md: string }

type Marks = { bold?: boolean; italics?: boolean; strike?: boolean }
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
const MONO = 'Consolas'

// Office Math inserted as raw XML (docx has no LaTeX support); null → caller falls back to text
function mathXml(latex: string, display: boolean): ParagraphChild | null {
  const omml = latexToOmml(latex, display)
  if (!omml) return null
  const imported = ImportedXmlComponent.fromXmlString(omml)
  // fromXmlString wraps the parsed nodes in a root; take the element itself
  const root = (imported as unknown as { root: unknown[] }).root
  return (root?.[0] ?? imported) as unknown as ParagraphChild
}

function inline(nodes: PhrasingContent[], marks: Marks = {}): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out.push(new TextRun({ text: n.value, ...marks })); break
      case 'strong': out.push(...inline(n.children, { ...marks, bold: true })); break
      case 'emphasis': out.push(...inline(n.children, { ...marks, italics: true })); break
      case 'delete': out.push(...inline(n.children, { ...marks, strike: true })); break
      case 'inlineCode': out.push(new TextRun({ text: n.value, font: MONO, ...marks })); break
      case 'break': out.push(new TextRun({ break: 1 })); break
      case 'link':
        out.push(new ExternalHyperlink({ link: n.url, children: [new TextRun({ text: textOf(n.children), style: 'Hyperlink', ...marks })] }))
        break
      case 'image':
        out.push(new TextRun({ text: `[Image: ${n.alt || n.url}]`, italics: true, color: '6B6A65' }))
        break
      case 'inlineMath': out.push(mathXml(n.value, false) ?? new TextRun({ text: `$${n.value}$`, ...marks })); break
      default:
        if ('children' in n) out.push(...inline(n.children as PhrasingContent[], marks))
        else if ('value' in n) out.push(new TextRun({ text: String(n.value), ...marks }))
    }
  }
  return out
}

function textOf(nodes: PhrasingContent[]): string {
  return nodes.map(n => ('value' in n ? String(n.value) : 'children' in n ? textOf(n.children as PhrasingContent[]) : '')).join('')
}

// Each ordered list gets its own numbering definition, so separate lists never continue each
// other's numbers and a list starting at 5 starts at 5. Collected while building, used by Document.
let orderedLists: { reference: string; start: number }[] = []

function block(node: RootContent, ctx: { level: number }): (Paragraph | Table)[] {
  switch (node.type) {
    case 'heading':
      return [new Paragraph({ heading: HEADINGS[Math.min(node.depth, 6) - 1], children: inline(node.children) })]
    case 'paragraph': {
      // remark-math reports a lone "$$…$$" written inline as an inlineMath-only paragraph; keep it inline
      return [new Paragraph({ children: inline(node.children), spacing: { after: 120 } })]
    }
    case 'math': {
      const m = mathXml(node.value, true)
      return [new Paragraph({ alignment: AlignmentType.CENTER, children: [m ?? new TextRun({ text: `$$${node.value}$$`, font: MONO })] })]
    }
    case 'code':
      return node.value.split('\n').map(line => new Paragraph({
        children: [new TextRun({ text: line || ' ', font: MONO, size: 20 })],
        shading: { type: ShadingType.CLEAR, fill: 'F3F3F0', color: 'auto' },
      }))
    case 'blockquote':
      // Quoted paragraphs: indented, italic, with a left rule; other quoted blocks render as usual
      return node.children.flatMap(c => c.type === 'paragraph'
        ? [new Paragraph({
          children: inline(c.children, { italics: true }),
          indent: { left: 567 },
          border: { left: { style: 'single', size: 12, color: 'B4B2A9', space: 8 } },
        })]
        : block(c, ctx))
    case 'list':
      return list(node, ctx.level)
    case 'table':
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: node.children.map((row, r) => new TableRow({
          tableHeader: r === 0,
          children: row.children.map(cell => new TableCell({
            children: [new Paragraph({ children: inline(cell.children, r === 0 ? { bold: true } : {}) })],
          })),
        })),
      })]
    case 'thematicBreak':
      return [new Paragraph({ border: { bottom: { style: 'single', size: 6, color: 'CCCCCC', space: 1 } }, children: [] })]
    case 'html':
      return [new Paragraph({ children: [new TextRun({ text: node.value })] })]
    default:
      return []
  }
}

function list(node: List, level: number): (Paragraph | Table)[] {
  const lvl = Math.min(level, 8)
  let marker: { numbering: { reference: string; level: number } } | { bullet: { level: number } }
  if (node.ordered) {
    const reference = `ol-${orderedLists.length + 1}`
    orderedLists.push({ reference, start: node.start ?? 1 })
    marker = { numbering: { reference, level: lvl } }
  } else {
    marker = { bullet: { level: lvl } }
  }
  const out: (Paragraph | Table)[] = []
  for (const item of node.children) {
    const box = item.checked === true ? '☑ ' : item.checked === false ? '☐ ' : ''
    const [first, ...rest] = item.children
    if (first?.type === 'paragraph') {
      out.push(new Paragraph({ children: [...(box ? [new TextRun({ text: box })] : []), ...inline(first.children)], ...marker }))
    } else {
      // An item that opens with a code block or table still gets its bullet/number
      out.push(new Paragraph({ children: box ? [new TextRun({ text: box })] : [], ...marker }))
      if (first) out.push(...block(first, { level: level + 1 }))
    }
    for (const child of rest) {
      if (child.type === 'paragraph') {
        // Further paragraphs of the same item line up with the item's text
        out.push(new Paragraph({ children: inline(child.children), indent: { left: 720 * (lvl + 1) } }))
      } else {
        out.push(...block(child, { level: level + 1 }))
      }
    }
  }
  return out
}

export function noteParagraphs(note: ExportNote): (Paragraph | Table)[] {
  // Text pasted from Word/PDFs can carry control characters that XML (and Word) reject
  const content = stripControl(note.content_md)
  const title = stripControl(note.title)
  const course = note.course ? stripControl(note.course) : null
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(content) as Root
  const head = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title || 'Untitled' })] }),
    ...(course ? [new Paragraph({ children: [new TextRun({ text: course, italics: true, color: '6B6A65' })], spacing: { after: 240 } })] : []),
  ]
  return [...head, ...tree.children.flatMap(n => block(n, { level: 0 }))]
}

export async function notesToDocx(notes: ExportNote[]): Promise<Blob> {
  orderedLists = []
  const children = notes.flatMap((n, i) => [
    ...(i > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
    ...noteParagraphs(n),
  ])
  const doc = new Document({
    creator: 'Studyhub',
    title: notes.length === 1 ? notes[0].title : 'Studyhub notes',
    numbering: {
      config: orderedLists.map(({ reference, start }) => ({
        reference,
        levels: Array.from({ length: 9 }, (_, level) => ({
          level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START, start,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      })),
    },
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}
