import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { isAiConfigured } from '@/lib/ai/openai'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import {
  isDayKey, scanToCards, scanToNote, scanToPlanner,
  type ScanCardsResult, type ScanFile, type ScanNoteResult, type ScanPlannerResult, type ScanTarget,
} from '@/lib/ai/scan'
import { MAX_SCAN_PAGES } from '@/lib/scan/limits'
import { countPdfPages } from '@/lib/import/pdfPages'
import { pdfActionCost } from '@/lib/billing/plans'

// Reading up to 10 pages with the strong model can take a while; 300 s is the Hobby plan's maximum
export const maxDuration = 300

const TARGETS: ScanTarget[] = ['note', 'cards', 'planner']
const IMAGE_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
// Base64 grows files by a third and OpenAI caps a request at 32 MB
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const err = (status: number, error: string) => NextResponse.json({ error }, { status })
const extOf = (path: string) => path.slice(path.lastIndexOf('.') + 1).toLowerCase()

// POST { paths, target, today } — page photos or one PDF the student uploaded to the private
// "imports" bucket as "<user id>/<file>". Returns a draft for the student to review:
// note { title, content_md, truncated } · cards { cards } · planner { tasks, classes }.
// The uploads are deleted afterwards, whatever happens.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return err(401, 'unauthorized')

  const body = await request.json().catch(() => null) as { paths?: unknown; target?: unknown; today?: unknown } | null
  const prefix = `${user.id}/`
  const ownFile = (p: unknown): p is string => {
    if (typeof p !== 'string' || !p.startsWith(prefix)) return false
    const name = p.slice(prefix.length)
    return !!name && !name.includes('/') && !name.includes('..') && (extOf(name) === 'pdf' || extOf(name) in IMAGE_TYPES)
  }
  const raw = body?.paths
  const paths = Array.isArray(raw) && raw.length > 0 && raw.every(ownFile) ? (raw as string[]) : null
  const target = TARGETS.find(t => t === body?.target)
  if (!paths || !target) return err(400, 'bad_request')

  const bucket = sb.storage.from('imports')
  try {
    const pdfs = paths.filter(p => extOf(p) === 'pdf').length
    if (paths.length > MAX_SCAN_PAGES || (pdfs > 0 && paths.length > 1)) return err(413, 'too_many_pages')
    if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')

    const files: ScanFile[] = []
    let pages = 0
    let total = 0
    for (const path of paths) {
      // Downloaded with the student's own session, so storage policies still apply
      const { data, error } = await bucket.download(path)
      if (error || !data) return err(404, 'not_found')
      total += data.size
      if (total > MAX_TOTAL_BYTES) return err(413, 'too_large')
      const bytes = Buffer.from(await data.arrayBuffer())
      const ext = extOf(path)
      if (ext === 'pdf') {
        pages += await countPdfPages(bytes)
        files.push({ kind: 'pdf', name: path.slice(prefix.length).replace(/^[0-9a-f-]{36}-/i, ''), base64: bytes.toString('base64') })
      } else {
        pages += 1
        files.push({ kind: 'image', mime: IMAGE_TYPES[ext], base64: bytes.toString('base64') })
      }
    }
    if (pages > MAX_SCAN_PAGES) return err(413, 'too_many_pages')

    // The student's own date, so "due Friday" lands on the right day; the server's as a fallback
    const today = typeof body?.today === 'string' && isDayKey(body.today) ? body.today : new Date().toISOString().slice(0, 10)
    const result = await runAiAction<ScanNoteResult | ScanCardsResult | ScanPlannerResult>(client => (
      target === 'note' ? scanToNote(client, files, request.signal)
        : target === 'cards' ? scanToCards(client, files, request.signal)
          : scanToPlanner(client, files, today, request.signal)
    ), { userId: user.id, cost: pdfActionCost(pages), signal: request.signal })
    return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
  } finally {
    await bucket.remove(paths) // the browser deletes them too
  }
}
