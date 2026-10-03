import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AiEmptyError, AiIncompleteError, AiRefusedError, isAiConfigured, openai, type AiClient } from './openai'

export type AiErrorCode = 'ai_unavailable' | 'rate_limited' | 'busy' | 'refused' | 'too_long' | 'empty' | 'ai_failed' | 'aborted'
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode }

const STATUS: Record<AiErrorCode, number> = {
  ai_unavailable: 503, rate_limited: 429, busy: 429, refused: 422, too_long: 413, empty: 422, ai_failed: 502, aborted: 499,
}

// Every AI feature goes through here. There are no usage caps: the only check is a speed limit
// (10 AI requests a minute per student) that stops scripted abuse.
export async function runAiAction<T>(
  sb: SupabaseClient, call: (client: AiClient) => Promise<T>, opts: { signal?: AbortSignal; client?: AiClient } = {},
): Promise<AiResult<T>> {
  if (!opts.client && !isAiConfigured()) return { ok: false, error: 'ai_unavailable' }
  const { data: allowed } = await sb.rpc('ai_request_allowed')
  if (allowed !== true) return { ok: false, error: 'rate_limited' }
  try {
    return { ok: true, value: await call(opts.client ?? openai()) }
  } catch (e) {
    return { ok: false, error: classifyAiError(e, opts.signal) }
  }
}

export function classifyAiError(e: unknown, signal?: AbortSignal): AiErrorCode {
  if (signal?.aborted || e instanceof OpenAI.APIUserAbortError) return 'aborted'
  if (e instanceof AiRefusedError) return 'refused'
  if (e instanceof AiIncompleteError) return 'too_long'
  if (e instanceof AiEmptyError) return 'empty'
  // OpenAI says "insufficient_quota" when the app owner's credit has run out
  if (e instanceof OpenAI.APIError && (e as { code?: unknown }).code === 'insufficient_quota') return 'ai_unavailable'
  if (e instanceof OpenAI.RateLimitError || e instanceof OpenAI.InternalServerError || e instanceof OpenAI.APIConnectionError) return 'busy'
  if (e instanceof OpenAI.BadRequestError) return 'too_long' // in practice: the input was too big
  return 'ai_failed'
}

export function aiErrorResponse(code: AiErrorCode): Response {
  if (code === 'aborted') return new NextResponse(null, { status: 499 })
  return NextResponse.json({ error: code }, { status: STATUS[code] })
}
