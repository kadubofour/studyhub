import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { isAiConfigured } from '@/lib/ai/openai'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { MAX_FIGURES, redrawFigures, type FigureIn } from '@/lib/ai/redrawFigures'

export const maxDuration = 120

const MAX_IMAGE_CHARS = 2_500_000 // one picture's base64
const IMAGE = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/

// POST { figures: [{ image: "data:image/png;base64,…", caption }] } (up to MAX_FIGURES, cut from the student's PDF in their browser)
// → { drawings: ({ svg, width, height } | null)[] }, one for each, in order. One AI action for the whole request.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { figures?: unknown } | null
  const raw = Array.isArray(body?.figures) ? body.figures : null
  if (!raw || raw.length === 0 || raw.length > MAX_FIGURES) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const figures: FigureIn[] = []
  for (const f of raw as { image?: unknown; caption?: unknown }[]) {
    const m = typeof f?.image === 'string' && f.image.length <= MAX_IMAGE_CHARS ? IMAGE.exec(f.image) : null
    if (!m) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    figures.push({ mime: m[1] as FigureIn['mime'], base64: m[2], caption: typeof f.caption === 'string' ? f.caption.slice(0, 200) : '' })
  }
  if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')

  const result = await runAiAction(client => redrawFigures(client, figures, request.signal), { userId: user.id, cost: 1, signal: request.signal })
  return result.ok ? NextResponse.json({ drawings: result.value }) : aiErrorResponse(result.error)
}
