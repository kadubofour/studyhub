import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { MAX_PDF_PAGES, pdfToNote } from '@/lib/ai/pdfToNote'
import { isAiConfigured } from '@/lib/ai/openai'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { pdfActionCost } from '@/lib/billing/plans'

// A long PDF can take several minutes to convert. 300 s is the most Vercel's Hobby plan allows
// (a higher value fails the deploy); very long PDFs may time out. On Pro this can go up to 800.
export const maxDuration = 300

// Base64 grows the PDF by a third and the API caps a request at 32 MB, so files over ~24 MB can't be sent
const MAX_BYTES = 24 * 1024 * 1024
const STALE_UPLOAD_MS = 60 * 60 * 1000

// Rough page count from the PDF's page objects (compressed object streams can hide them; the API
// enforces its own page limit then, which we report the same way)
function countPages(bytes: Buffer): number {
  return (bytes.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
}

// POST { path } — a PDF the signed-in student uploaded to the private "imports" bucket as
// "<user id>/<file>.pdf". Returns { title, content_md, truncated }, or { error }:
// 503 ai_unavailable (no API key or credit; the browser falls back to plain text),
// 429 rate_limited / busy, 413 too_large / too_long, 422 refused / empty, 502 ai_failed.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { path?: unknown } | null
  const path = typeof body?.path === 'string' ? body.path : ''
  const prefix = `${user.id}/`
  const fileName = path.slice(prefix.length)
  if (!path.startsWith(prefix) || !fileName || fileName.includes('/') || fileName.includes('..') || !fileName.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'bad_path' }, { status: 400 })
  }

  const bucket = sb.storage.from('imports')
  try {
    // Best effort: remove this student's uploads abandoned by a closed tab or a timed-out conversion
    const { data: existing } = await bucket.list(user.id)
    const stale = (existing ?? [])
      .filter(f => f.name !== fileName && f.created_at && Date.now() - new Date(f.created_at).getTime() > STALE_UPLOAD_MS)
      .map(f => `${prefix}${f.name}`)
    if (stale.length) await bucket.remove(stale)

    if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')
    // Downloaded with the student's own session, so storage policies still apply
    const { data: file, error } = await bucket.download(path)
    if (error || !file) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
    const bytes = Buffer.from(await file.arrayBuffer())
    if (countPages(bytes) > MAX_PDF_PAGES) return NextResponse.json({ error: 'too_long' }, { status: 413 })

    const displayName = fileName.replace(/^[0-9a-f-]{36}-/i, '')
    // runAiAction checks the plan (checked last, so rejections above are free) and charges 1 AI
    // action per 10 pages only if the conversion succeeds. request.signal: if the student cancels
    // or closes the tab, the model call stops too.
    const result = await runAiAction(client => pdfToNote(client, bytes.toString('base64'), displayName, { signal: request.signal }), { userId: user.id, cost: pdfActionCost(countPages(bytes)), signal: request.signal })
    return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
  } finally {
    // The PDF is only needed for this one conversion
    await bucket.remove([path]).catch(() => {})
  }
}
