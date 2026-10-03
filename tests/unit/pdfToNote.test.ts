import { describe, it, expect, vi } from 'vitest'
import { pdfToNote, parseNoteMarkdown, PDF_IMPORT_MODEL } from '@/lib/ai/pdfToNote'
import { AiRefusedError } from '@/lib/ai/openai'

function fakeClient(reply: { text: string; status?: string; reason?: string; refusal?: boolean }) {
  const create = vi.fn(async (...args: unknown[]) => {
    void args
    return {
      status: reply.status ?? 'completed',
      incomplete_details: reply.reason ? { reason: reply.reason } : null,
      output_text: reply.text,
      output: reply.refusal ? [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] : [],
    }
  })
  return { client: { responses: { create } }, create }
}

describe('pdfToNote', () => {
  it('sends the PDF as a file input to the strong OpenAI model with the conversion instructions', async () => {
    const { client, create } = fakeClient({ text: '# Cell biology\n\n## Mitochondria\n\nMake ATP.' })
    await pdfToNote(client as never, 'JVBERi0x', 'cells.pdf')
    const params = create.mock.calls[0][0] as { model: string; instructions: string; max_output_tokens: number; input: { content: unknown[] }[] }
    expect(PDF_IMPORT_MODEL).toBe('gpt-6.1-sol')
    expect(params.model).toBe('gpt-6.1-sol')
    expect(params.instructions).toMatch(/LaTeX/)
    expect(params.max_output_tokens).toBe(32000)
    expect(params.input[0].content[0]).toEqual({ type: 'input_file', filename: 'cells.pdf', file_data: 'data:application/pdf;base64,JVBERi0x' })
  })

  it('returns the title and the Markdown body', async () => {
    const { client } = fakeClient({ text: '# Cell biology\n\n## Mitochondria\n\nMake $ATP$.' })
    const note = await pdfToNote(client as never, 'x', 'cells.pdf')
    expect(note).toEqual({ title: 'Cell biology', content_md: '## Mitochondria\n\nMake $ATP$.', truncated: false })
  })

  it('marks the note truncated when the output limit was hit', async () => {
    const { client } = fakeClient({ text: '# T\n\nbody', status: 'incomplete', reason: 'max_output_tokens' })
    expect((await pdfToNote(client as never, 'x', 'a.pdf')).truncated).toBe(true)
  })

  it('throws AiRefusedError on a refusal', async () => {
    const { client } = fakeClient({ text: '', refusal: true })
    await expect(pdfToNote(client as never, 'x', 'a.pdf')).rejects.toBeInstanceOf(AiRefusedError)
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
