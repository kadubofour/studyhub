import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { SharedView, type Shared } from '@/components/share/SharedView'
import { isShareToken } from '@/lib/share/token'

// A share link, /s/<token>: open to anyone who has it, signed in or not, and never for search engines
export const metadata: Metadata = { title: 'Shared with you', robots: { index: false, follow: false } }

export default async function SharedPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  const sb = await createServerSupabase()
  const [{ data: { user } }, shared] = await Promise.all([
    sb.auth.getUser(),
    isShareToken(token)
      ? sb.rpc('shared_item', { p_token: token }).then(r => (r.error ? null : (r.data as Shared | null)), () => null)
      : Promise.resolve(null),
  ])
  return (
    <ToastProvider>
      <SharedView token={token} shared={shared} signedIn={!!user} askedToCopy={query.copy === '1'} />
    </ToastProvider>
  )
}
