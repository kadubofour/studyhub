import { describe, it, expect, afterEach } from 'vitest'
import { POST } from '@/app/api/test-openai/v1/responses/route'

const call = (body: object) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))
afterEach(() => { delete process.env.E2E_FAKE_AI })

describe('fake OpenAI (E2E only)', () => {
  it('does not exist unless E2E mode is on', async () => {
    expect((await call({ text: { format: { name: 'summary' } } })).status).toBe(404)
  })
  it('answers structured requests with canned JSON in the Responses API shape', async () => {
    process.env.E2E_FAKE_AI = '1'
    const res = await call({ model: 'gpt-6-luna', text: { format: { type: 'json_schema', name: 'summary' } } })
    const body = await res.json() as { status: string; output: { type: string; content: { type: string; text: string }[] }[] }
    expect(body.status).toBe('completed')
    expect(JSON.parse(body.output[0].content[0].text)).toHaveProperty('summary_md')
  })
  it('rejects a PDF whose name contains "fallback", so E2E can exercise the plain-text fallback', async () => {
    process.env.E2E_FAKE_AI = '1'
    const res = await call({ input: [{ role: 'user', content: [{ type: 'input_file', filename: 'cells-fallback.pdf', file_data: 'x' }] }] })
    expect(res.status).toBe(400)
  })
  it('streams a canned tutor reply as server-sent events when asked to', async () => {
    process.env.E2E_FAKE_AI = '1'
    const res = await call({ stream: true, input: [{ role: 'user', content: 'Why is it in the matrix?' }] })
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('event: response.output_text.delta')
    expect(text).toContain('mitochondrial matrix')
    expect(text).toContain('event: response.completed')
    expect(text).not.toContain('function_call')
  })
  it('adds a flashcards tool call when the student asks for flashcards', async () => {
    process.env.E2E_FAKE_AI = '1'
    const text = await (await call({ stream: true, input: [{ role: 'user', content: 'Make flashcards on this' }] })).text()
    expect(text).toContain('"type":"function_call"')
    expect(text).toContain('create_flashcards')
    expect(text).toContain('Krebs tutor deck')
  })
  it('answers a topics request with topics that link the notes found in the prompt', async () => {
    process.env.E2E_FAKE_AI = '1'
    const N1 = '22222222-2222-4222-8222-222222222222', N2 = '33333333-3333-4333-8333-333333333333'
    const input = [{ role: 'user', content: `Course material:\n<note id="${N1}" title="A">\ntext\n</note>\n\n<note id="${N2}" title="B">\ntext\n</note>` }]
    const draft = await (await call({ text: { format: { name: 'topics' } }, input })).json() as { output: { content: { text: string }[] }[] }
    expect(JSON.parse(draft.output[0].content[0].text).topics).toEqual([
      { name: 'Krebs cycle', notes: [N1, N2], lectures: [] }, { name: 'Glycolysis', notes: [N1], lectures: [] },
    ])
    const update = await (await call({ text: { format: { name: 'topics' } }, input: [{ role: 'user', content: `Existing topics:\n- Krebs cycle\n\nNew material:\n<note id="${N2}" title="B">\ntext\n</note>` }] })).json() as { output: { content: { text: string }[] }[] }
    expect(JSON.parse(update.output[0].content[0].text).topics).toEqual([{ name: 'Pyruvate', notes: [N2], lectures: [] }])
  })
})
