import { describe, it, expect, vi } from 'vitest'
import { streamTutor } from '@/lib/ai/tutor'
import { AiIncompleteError, AiRefusedError } from '@/lib/ai/openai'

const events = (list: object[]) => ({ [Symbol.asyncIterator]: async function* () { for (const e of list) yield e } })
const clientOf = (list: object[]) => {
  const create = vi.fn(async () => events(list))
  return { client: { responses: { create } } as never, create }
}
const collect = async (gen: AsyncGenerator<unknown>) => { const out: unknown[] = []; for await (const e of gen) out.push(e); return out }
const run = (client: never) => streamTutor(client, { instructions: 'i', input: [{ role: 'user', content: 'hi' }], tools: [] })

describe('streamTutor', () => {
  it('asks for a streamed reply with the strong model and the tools', async () => {
    const { client, create } = clientOf([{ type: 'response.completed' }])
    await collect(run(client))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-6.1-sol', stream: true, instructions: 'i', tools: [] }), expect.anything())
  })
  it('yields the words as they arrive and each finished tool call', async () => {
    const { client } = clientOf([
      { type: 'response.output_text.delta', delta: 'The Krebs ' }, { type: 'response.output_text.delta', delta: 'cycle.' },
      { type: 'response.output_item.done', item: { type: 'function_call', name: 'create_note', arguments: '{"title":"x"}' } },
      { type: 'response.output_item.done', item: { type: 'message' } }, { type: 'response.completed' },
    ])
    expect(await collect(run(client))).toEqual([
      { type: 'delta', text: 'The Krebs ' }, { type: 'delta', text: 'cycle.' }, { type: 'tool', name: 'create_note', args: '{"title":"x"}' },
    ])
  })
  it('throws when the model refuses, or the reply is cut off', async () => {
    await expect(collect(run(clientOf([{ type: 'response.refusal.done' }]).client))).rejects.toBeInstanceOf(AiRefusedError)
    await expect(collect(run(clientOf([{ type: 'response.incomplete' }]).client))).rejects.toBeInstanceOf(AiIncompleteError)
  })
  it('throws when the model reports a failure', async () => {
    await expect(collect(run(clientOf([{ type: 'response.failed', response: { error: { message: 'boom' } } }]).client))).rejects.toThrow('boom')
  })
})
