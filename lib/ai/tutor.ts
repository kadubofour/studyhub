import type OpenAI from 'openai'
import { AiIncompleteError, AiRefusedError, MODELS, type AiClient } from './openai'

// How hard the model thinks before it answers. Raise it if explanations come out shallow.
export const TUTOR_EFFORT = 'low' as const

export type TutorEvent = { type: 'delta'; text: string } | { type: 'tool'; name: string; args: string }

// One tutor turn, as the model writes it: words as they come, then each tool call the model finished.
export async function* streamTutor(client: AiClient, o: {
  instructions: string; input: import('./tutorContext').TutorInputItem[]; tools: OpenAI.Responses.Tool[]; signal?: AbortSignal
}): AsyncGenerator<TutorEvent> {
  const stream = await client.responses.create({
    model: MODELS.strong, instructions: o.instructions, input: o.input, tools: o.tools, stream: true, max_output_tokens: 6000,
    reasoning: { effort: TUTOR_EFFORT }, // less thinking before the first word; the tutor teaches from the student's own material, so it needs little
  }, { signal: o.signal })
  let gotSomething = false
  let final: OpenAI.Responses.Response | undefined
  for await (const ev of stream) {
    if (ev.type === 'response.output_text.delta') { gotSomething ||= !!ev.delta.trim(); yield { type: 'delta', text: ev.delta } }
    else if (ev.type === 'response.output_item.done' && ev.item.type === 'function_call') { gotSomething = true; yield { type: 'tool', name: ev.item.name, args: ev.item.arguments } }
    else if (ev.type === 'response.refusal.done') throw new AiRefusedError()
    else if (ev.type === 'response.incomplete') throw new AiIncompleteError()
    else if (ev.type === 'response.failed') throw new Error(ev.response.error?.message ?? 'The AI failed.')
    else if (ev.type === 'response.completed') final = ev.response
  }
  // A turn with nothing in it is a failure, not an empty reply; what the model did send says why it happened
  if (!gotSomething) {
    console.warn('The tutor got an empty reply', { status: final?.status ?? 'stream ended early', output: final?.output?.map(o => o.type), usage: final?.usage })
    throw new Error('The AI sent back nothing.')
  }
}
