import type { BetaMessage, BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'

// PDF → structured study note, using Claude's native PDF reading (text + layout).
// Server-only: called from app/api/import/pdf/route.ts with the server's API key.

export const PDF_IMPORT_MODEL = 'claude-opus-5-5'
// Keeps a conversion within the route's time limit and bounds its cost
export const MAX_PDF_PAGES = 100

export class PdfRefusedError extends Error {
  constructor() { super('The PDF could not be converted.') }
}

const SYSTEM = `You turn a PDF a student uploaded into a study note written in Markdown.

Keep the document's structure and wording:
- Start with exactly one line "# <title>", using the document's own title (or a short descriptive one if it has none).
- Use ##/### for the document's sections and subsections, in order.
- Keep paragraphs, bulleted and numbered lists, checklists, block quotes and code blocks as they appear.
- Reproduce tables as GitHub-flavoured Markdown tables.
- Write every mathematical expression as LaTeX: inline as $...$, displayed equations on their own lines between $$ and $$.
- Keep bold and italic emphasis.

Do not summarise, shorten, reorder, add commentary or invent content. Leave out page numbers, running headers and footers, and other layout debris. Describe a figure in one italic line only if it carries information the text does not.

Reply with the Markdown note only.`

type StreamingClient = { beta: { messages: { stream: (params: BetaMessageStreamParams, options?: { signal?: AbortSignal }) => { finalMessage(): Promise<BetaMessage> } } } }

export function parseNoteMarkdown(text: string, fileName: string): { title: string; content_md: string } {
  let md = text.trim().replace(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/, '$1').trim()
  const fallback = fileName.replace(/\.pdf$/i, '').trim() || 'Imported note'
  const m = md.match(/^#\s+(.+)\n?/)
  if (!m) return { title: fallback, content_md: md }
  md = md.slice(m[0].length).trim()
  return { title: m[1].trim() || fallback, content_md: md }
}

export async function pdfToNote(
  client: StreamingClient, pdfBase64: string, fileName: string, options: { signal?: AbortSignal } = {},
): Promise<{ title: string; content_md: string; truncated: boolean }> {
  const message = await client.beta.messages.stream({
    model: PDF_IMPORT_MODEL,
    max_tokens: 32000, // ample for a 100-page note; bounds cost and time
    output_config: { effort: 'medium' },
    // If a safety classifier declines, the API re-runs the request on a fallback model
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: `Convert this PDF ("${fileName}") into a note.` },
      ],
    }],
  }, { signal: options.signal }).finalMessage()

  if (message.stop_reason === 'refusal') throw new PdfRefusedError()
  const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  return { ...parseNoteMarkdown(text, fileName), truncated: message.stop_reason === 'max_tokens' }
}
