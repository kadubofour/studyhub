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
})
