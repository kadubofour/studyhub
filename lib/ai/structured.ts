import { zodTextFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import { AiIncompleteError, AiRefusedError, type AiClient } from './openai'

type OutputItem = { type?: string; content?: { type?: string }[] }

export function hasRefusal(res: { output?: unknown[] }): boolean {
  return ((res.output ?? []) as OutputItem[]).some(o => o.type === 'message' && (o.content ?? []).some(c => c.type === 'refusal'))
}

// One structured-output call: the reply always matches `schema` (strict JSON schema), and is
// validated again with Zod before anyone uses it.
export async function generateObject<T extends z.ZodType>(client: AiClient, o: {
  model: string; instructions: string; input: string; schema: T; name: string; maxOutputTokens?: number; signal?: AbortSignal
}): Promise<z.infer<T>> {
  const res = await client.responses.parse({
    model: o.model,
    instructions: o.instructions,
    input: [{ role: 'user', content: o.input }],
    text: { format: zodTextFormat(o.schema, o.name) },
    max_output_tokens: o.maxOutputTokens ?? 16000,
  }, { signal: o.signal })
  if (hasRefusal(res)) throw new AiRefusedError()
  if (res.status === 'incomplete' || res.output_parsed == null) throw new AiIncompleteError()
  return o.schema.parse(res.output_parsed)
}
