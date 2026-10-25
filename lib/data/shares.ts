import type { SupabaseClient } from '@supabase/supabase-js'
import type { Shared, SharedProgress } from '@/components/share/SharedView'

// Thin wrappers over share_item, reshare_item, unshare_item, share_progress and shared_item (supabase/migrations/20261113000000_shares.sql).
// A raised error comes back with its code as the message ('not_owner', 'rate_limited') and is thrown as Error(code).

export type ShareKind = 'deck' | 'note' | 'notebook'

type Res<T> = { data: T | null; error: { message: string } | null }
function data<T>(res: Res<T>): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** The item's link token: the active one, or a new one */
export const shareItem = async (sb: SupabaseClient, kind: ShareKind, id: string) =>
  data<string>(await sb.rpc('share_item', { p_kind: kind, p_item: id }))
/** Turns the old link off and makes a new token */
export const reshareItem = async (sb: SupabaseClient, kind: ShareKind, id: string) =>
  data<string>(await sb.rpc('reshare_item', { p_kind: kind, p_item: id }))
export async function unshareItem(sb: SupabaseClient, kind: ShareKind, id: string): Promise<void> {
  data(await sb.rpc('unshare_item', { p_kind: kind, p_item: id }))
}

/** A new progress card: a snapshot of the numbers now, and its link token */
export const shareProgress = async (sb: SupabaseClient) => data<string>(await sb.rpc('share_progress'))
/** What a progress card's link shows: the snapshot, or null when the link is off */
export async function progressSnapshot(sb: SupabaseClient, token: string): Promise<SharedProgress | null> {
  const shared = data<Shared | null>(await sb.rpc('shared_item', { p_token: token }))
  return shared?.kind === 'progress' ? shared.item : null
}
