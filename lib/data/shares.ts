import type { SupabaseClient } from '@supabase/supabase-js'

// Thin wrappers over share_item, reshare_item and unshare_item (supabase/migrations/20261113000000_shares.sql).
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
