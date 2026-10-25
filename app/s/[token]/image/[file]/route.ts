import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { IMAGE_BUCKET, imagePath, toToken, tokenFile } from '@/lib/notes/images'
import { isShareToken } from '@/lib/share/token'

const LINK_SECONDS = 3600
const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

// A picture in a shared note, for anyone with the link: only a file the shared note (or notebook) uses, sent on to a
// one-hour signed link made with the server's own key. Anything else, a turned-off link, or a missing file is a 404.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file: raw } = await params
  let name = raw
  try { name = decodeURIComponent(raw) } catch { return notFound() }
  const file = tokenFile(toToken(name))
  if (!isShareToken(token) || !file || !process.env.SUPABASE_SERVICE_ROLE_KEY) return notFound()
  try {
    const admin = adminClient()
    const { data, error } = await admin.rpc('shared_note_files', { p_token: token })
    if (error) return notFound()
    const hit = ((data ?? []) as { owner_id: string; file: string }[]).find(f => f.file === file)
    if (!hit) return notFound()
    const signed = await admin.storage.from(IMAGE_BUCKET).createSignedUrl(imagePath(hit.owner_id, file), LINK_SECONDS)
    if (signed.error || !signed.data?.signedUrl) return notFound()
    const res = NextResponse.redirect(signed.data.signedUrl, 307)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch {
    return notFound()
  }
}
