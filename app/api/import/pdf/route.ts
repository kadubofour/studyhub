import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { pdfToNote, PdfRefusedError } from '@/lib/ai/pdfToNote'

// Converting a long PDF can take a few minutes
export const maxDuration = 300

const MAX_BYTES = 32 * 1024 * 1024

// POST { path } — path of a PDF the signed-in student uploaded to the private "imports" bucket.
// Returns { title, content_md, truncated }. 503 { error: 'ai_unavailable' } when no API key is configured,
// so the browser falls back to plain-text extraction.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { path?: unknown } | null
  const path = typeof body?.path === 'string' ? body.path : ''
  if (!path.startsWith(`${user.id}/`) || path.includes('..') || !path.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'bad_path' }, { status: 400 })
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
    }
    // Downloaded with the student's own session, so storage policies still apply
    const { data: file, error } = await sb.storage.from('imports').download(path)
    if (error || !file) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const fileName = path.split('/').pop() ?? 'document.pdf'
    const note = await pdfToNote(new Anthropic(), base64, fileName)
    return NextResponse.json(note)
  } catch (e) {
    if (e instanceof PdfRefusedError) return NextResponse.json({ error: 'refused' }, { status: 422 })
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'busy' }, { status: 429 })
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: 'ai_failed' }, { status: 502 })
    throw e
  } finally {
    // The PDF is only needed for this one conversion
    await sb.storage.from('imports').remove([path]).catch(() => {})
  }
}
