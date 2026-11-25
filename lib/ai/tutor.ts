import type OpenAI from 'openai'
import { LESSON_STATE_TOOL } from './tutorTools'
import { AiIncompleteError, AiRefusedError, MODELS, type AiClient } from './openai'

export type TutorEvent = { type: 'delta'; text: string } | { type: 'tool'; name: string; args: string }

// One tutor turn, as the model writes it: words as they come, then each tool call the model finished.
const WORDS_NOW = '\n- Write your reply to the student in words now. Your lesson notes are already saved: do not use a tool just to record them, and never end a turn without a reply.'

// One tutor turn, as the model writes it: words as they come, then each tool call the model finished.
// A turn that ends in a tool call stops there, and the lesson notes are kept by the server without a result going back, so a model that saves
// them before it writes anything has said nothing. Such a turn (or one with nothing at all) is asked once more without that tool, and told to answer.
export async function* streamTutor(client: AiClient, o: {
  instructions: string; input: import('./tutorContext').TutorInputItem[]; tools: OpenAI.Responses.Tool[]; signal?: AbortSignal
}): AsyncGenerator<TutorEvent> {
  const attempt = async function* (instructions: string, tools: OpenAI.Responses.Tool[]): AsyncGenerator<TutorEvent, { words: boolean; asks: boolean }> {
    const stream = await client.responses.create({
      model: MODELS.strong, instructions, input: o.input, tools, stream: true, max_output_tokens: 6000,
    }, { signal: o.signal })
    let words = false
    let asks = false // a tool call that gives the student something to approve or open
    let final: OpenAI.Responses.Response | undefined
    for await (const ev of stream) {
      if (ev.type === 'response.output_text.delta') { words ||= !!ev.delta.trim(); yield { type: 'delta', text: ev.delta } }
      else if (ev.type === 'response.output_item.done' && ev.item.type === 'function_call') { asks ||= ev.item.name !== LESSON_STATE_TOOL; yield { type: 'tool', name: ev.item.name, args: ev.item.arguments } }
      else if (ev.type === 'response.refusal.done') throw new AiRefusedError()
      else if (ev.type === 'response.incomplete') throw new AiIncompleteError()
      else if (ev.type === 'response.failed') throw new Error(ev.response.error?.message ?? 'The AI failed.')
      else if (ev.type === 'response.completed') final = ev.response
    }
    if (!words && !asks) console.warn('The tutor got a turn with nothing for the student', { status: final?.status ?? 'stream ended early', output: final?.output?.map(x => x.type), usage: final?.usage })
    return { words, asks }
  }
  const first = yield* attempt(o.instructions, o.tools)
  if (first.words || first.asks) return
  const second = yield* attempt(o.instructions + WORDS_NOW, o.tools.filter(t => !(t.type === 'function' && t.name === LESSON_STATE_TOOL)))
  // A turn with nothing in it is a failure, not an empty reply
  if (!second.words && !second.asks) throw new Error('The AI sent back nothing.')
}
