import type OpenAI from 'openai'
import { AiIncompleteError, AiRefusedError, MODELS, type AiClient } from './openai'

export type TutorEvent = { type: 'delta'; text: string } | { type: 'tool'; name: string; args: string }

// One tutor turn, as the model writes it: words as they come, then each tool call the model finished.
export async function* streamTutor(client: AiClient, o: {
  instructions: string; input: { role: 'user' | 'assistant'; content: string }[]; tools: OpenAI.Responses.Tool[]; signal?: AbortSignal
}): AsyncGenerator<TutorEvent> {
  const stream = await client.responses.create({
    model: MODELS.strong, instructions: o.instructions, input: o.input, tools: o.tools, stream: true, max_output_tokens: 6000,
  }, { signal: o.signal })
  for await (const ev of stream) {
    if (ev.type === 'response.output_text.delta') yield { type: 'delta', text: ev.delta }
    else if (ev.type === 'response.output_item.done' && ev.item.type === 'function_call') yield { type: 'tool', name: ev.item.name, args: ev.item.arguments }
    else if (ev.type === 'response.refusal.done') throw new AiRefusedError()
    else if (ev.type === 'response.incomplete') throw new AiIncompleteError()
    else if (ev.type === 'response.failed') throw new Error(ev.response.error?.message ?? 'The AI failed.')
  }
}
