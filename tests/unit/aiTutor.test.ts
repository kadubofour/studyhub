import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    const { client, create } = clientOf([{ type: 'response.output_text.delta', delta: 'Hi' }, { type: 'response.completed' }])
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
  describe('a reply with nothing in it', () => {
    let warn: ReturnType<typeof vi.spyOn>
    beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
    afterEach(() => { warn.mockRestore() })
    it('fails, and logs what the model did send, when it finished with no words and no tool call', async () => {
      await expect(collect(run(clientOf([{ type: 'response.completed', response: { status: 'completed', output: [{ type: 'reasoning' }], usage: { output_tokens: 90 } } }]).client))).rejects.toThrow('nothing')
      expect(warn).toHaveBeenCalledWith(expect.any(String), { status: 'completed', output: ['reasoning'], usage: { output_tokens: 90 } })
    })
    it('fails when the stream stops without finishing, and says so in the log', async () => {
      await expect(collect(run(clientOf([]).client))).rejects.toThrow('nothing')
      expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'stream ended early' }))
    })
    it('counts only spaces as nothing', async () => {
      await expect(collect(run(clientOf([{ type: 'response.output_text.delta', delta: ' \n' }, { type: 'response.completed' }]).client))).rejects.toThrow('nothing')
    })
    it('accepts a reply that is only a tool call', async () => {
      const list = [{ type: 'response.output_item.done', item: { type: 'function_call', name: 'create_note', arguments: '{}' } }, { type: 'response.completed' }]
      expect(await collect(run(clientOf(list).client))).toEqual([{ type: 'tool', name: 'create_note', args: '{}' }])
      expect(warn).not.toHaveBeenCalled()
    })
  })
  describe('a turn that only saves the lesson notes', () => {
    const state = { type: 'response.output_item.done', item: { type: 'function_call', name: 'save_lesson_state', arguments: '{"state":"x"}' } }
    const tool = (name: string) => ({ type: 'function', name }) as never
    it('is asked again without that tool, and the second answer is the reply', async () => {
      const turns = [[state, { type: 'response.completed' }], [{ type: 'response.output_text.delta', delta: 'Next: unions.' }, { type: 'response.completed' }]]
      const create = vi.fn(async () => events(turns.shift()!))
      const out = await collect(streamTutor({ responses: { create } } as never, { instructions: 'i', input: [{ role: 'user', content: 'continue' }], tools: [tool('save_lesson_state'), tool('create_note')] }))
      expect(out).toEqual([{ type: 'tool', name: 'save_lesson_state', args: '{"state":"x"}' }, { type: 'delta', text: 'Next: unions.' }])
      expect(create).toHaveBeenCalledTimes(2)
      const second = (create.mock.calls[1] as unknown as [{ instructions: string; tools: { name: string }[] }])[0]
      expect(second.tools.map(t => t.name)).toEqual(['create_note'])
      expect(second.instructions).toContain('in words now')
    })
    it('is not asked again when it has words as well', async () => {
      const { client, create } = clientOf([state, { type: 'response.output_text.delta', delta: 'Hi' }, { type: 'response.completed' }])
      await collect(run(client))
      expect(create).toHaveBeenCalledTimes(1)
    })
    it('fails when the second try is empty too', async () => {
      const { client } = clientOf([state, { type: 'response.completed' }])
      await expect(collect(run(client))).rejects.toThrow('nothing')
    })
  })
  it('throws when the model reports a failure', async () => {
    await expect(collect(run(clientOf([{ type: 'response.failed', response: { error: { message: 'boom' } } }]).client))).rejects.toThrow('boom')
  })
})
