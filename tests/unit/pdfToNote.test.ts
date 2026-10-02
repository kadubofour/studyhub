import { describe, it, expect, vi } from 'vitest'
import { pdfToNote, parseNoteMarkdown, PDF_IMPORT_MODEL, PdfRefusedError } from '@/lib/ai/pdfToNote'

function fakeClient(reply: { text: string; stop_reason?: string }) {
  const stream = vi.fn((...args: [Record<string, unknown>]) => ({
    args,
    finalMessage: async () => ({ content: [{ type: 'text', text: reply.text }], stop_reason: reply.stop_reason ?? 'end_turn' }),
  }))
  return { client: { beta: { messages: { stream } } }, stream }
}

describe('pdfToNote', () => {
  it('sends the PDF as a document block to Claude Opus 5.5 with refusal fallbacks on', async () => {
    const { client, stream } = fakeClient({ text: '# Cell biology\n\n## Mitochondria\n\nMake ATP.' })
    await pdfToNote(client as never, 'JVBERi0x', 'cells.pdf')
    const params = stream.mock.calls[0][0] as {
      model: string; betas: string[]; fallbacks: unknown; system: string; messages: { content: unknown[] }[]
    }
    expect(PDF_IMPORT_MODEL).toBe('claude-opus-5-5')
    expect(params.model).toBe('claude-opus-5-5')
    expect(params.betas).toContain('server-side-fallback-2026-07-01')
    expect(params.fallbacks).toBe('default')
    const doc = params.messages[0].content[0]
    expect(doc).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0x' } })
    expect(params.system).toMatch(/LaTeX/)
  })

  it('returns the title and the Markdown body', async () => {
    const { client } = fakeClient({ text: '# Cell biology\n\n## Mitochondria\n\nMake $ATP$.' })
    const note = await pdfToNote(client as never, 'x', 'cells.pdf')
    expect(note).toEqual({ title: 'Cell biology', content_md: '## Mitochondria\n\nMake $ATP$.', truncated: false })
  })

  it('flags a note cut off by the length limit instead of dropping it', async () => {
    const { client } = fakeClient({ text: '# Long\n\nlots', stop_reason: 'max_tokens' })
    expect((await pdfToNote(client as never, 'x', 'long.pdf')).truncated).toBe(true)
  })

  it('throws a clear error when the request is refused', async () => {
    const { client } = fakeClient({ text: '', stop_reason: 'refusal' })
    await expect(pdfToNote(client as never, 'x', 'a.pdf')).rejects.toBeInstanceOf(PdfRefusedError)
  })
})

describe('parseNoteMarkdown', () => {
  it('uses the file name when there is no title line', () => {
    expect(parseNoteMarkdown('Just text', 'Week 3.pdf')).toEqual({ title: 'Week 3', content_md: 'Just text' })
  })
  it('strips a wrapping ```markdown fence if the model adds one', () => {
    expect(parseNoteMarkdown('```markdown\n# T\n\nBody\n```', 'f.pdf')).toEqual({ title: 'T', content_md: 'Body' })
  })
})
