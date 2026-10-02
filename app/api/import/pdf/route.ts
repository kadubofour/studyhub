import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { MAX_PDF_PAGES, pdfToNote, PdfRefusedError } from '@/lib/ai/pdfToNote'

// A long PDF can take several minutes to convert. 800 s is the most Vercel allows (Pro, fluid
// compute); on smaller plans the platform's own cap applies and long PDFs may time out.
export const maxDuration = 800

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
// 503 ai_unavailable (no API key; the browser falls back to plain text), 429 quota / busy,
// 413 too_large / too_long, 422 refused, 502 ai_failed.
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

    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
    }
    // Downloaded with the student's own session, so storage policies still apply
    const { data: file, error } = await bucket.download(path)
    if (error || !file) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
    const bytes = Buffer.from(await file.arrayBuffer())
    if (countPages(bytes) > MAX_PDF_PAGES) return NextResponse.json({ error: 'too_long' }, { status: 413 })

    // Each AI import uses one of the student's 20 a day (checked last, so rejections above are free)
    const { data: allowed } = await sb.rpc('consume_ai_import')
    if (allowed !== true) return NextResponse.json({ error: 'quota' }, { status: 429 })

    const displayName = fileName.replace(/^[0-9a-f-]{36}-/i, '')
    // request.signal: if the student cancels or closes the tab, the model call stops too
    const note = await pdfToNote(new Anthropic(), bytes.toString('base64'), displayName, { signal: request.signal })
    return NextResponse.json(note)
  } catch (e) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 })
    if (e instanceof PdfRefusedError) return NextResponse.json({ error: 'refused' }, { status: 422 })
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'busy' }, { status: 429 })
    if (e instanceof Anthropic.BadRequestError) return NextResponse.json({ error: 'too_long' }, { status: 413 })
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: 'ai_failed' }, { status: 502 })
    throw e
  } finally {
    // The PDF is only needed for this one conversion
    await bucket.remove([path]).catch(() => {})
  }
}
