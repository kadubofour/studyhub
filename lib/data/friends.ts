import type { SupabaseClient } from '@supabase/supabase-js'
import { check, must } from '@/lib/data/util'

// Friends, the weekly board and sharing (supabase/migrations/20261109000000_friends.sql). Another student is only ever seen
// through these functions: a name, an avatar colour, this week's XP, and what they chose to share.

export type Friend = { id: string; user_id: string; display_name: string; avatar_color: string; status: 'pending' | 'accepted'; incoming: boolean; since: string }
export type BoardRow = { user_id: string; display_name: string; avatar_color: string; xp: number; is_me: boolean }
export type ShareKind = 'note' | 'deck'
export type SharedWithMe = { id: string; kind: ShareKind; item_id: string; title: string; owner_id: string; owner_name: string; owner_color: string; created_at: string }
export type SharedByMe = { id: string; kind: ShareKind; item_id: string; title: string; recipient_id: string; recipient_name: string; created_at: string }
export type SharedNote = { title: string; content_md: string; ink: unknown; owner_id: string; owner_name: string; updated_at: string }
export type SharedDeck = { name: string; owner_name: string; cards: { front: string; back: string }[] }

export async function myFriendCode(sb: SupabaseClient): Promise<string> {
  return (must(await sb.from('profiles').select('friend_code').single()) as { friend_code: string }).friend_code
}

// What happened, in words the page can show
export type RequestResult = 'sent' | 'accepted' | 'already_asked' | 'already_friends'
export class FriendCodeError extends Error {}
export async function sendFriendRequest(sb: SupabaseClient, code: string): Promise<RequestResult> {
  const { data, error } = await sb.rpc('send_friend_request', { p_code: code })
  if (error) {
    if (error.code === 'P0002') throw new FriendCodeError('No one has that code. Check it and try again.')
    if (error.code === '22023') throw new FriendCodeError('That is your own code. Send it to a friend instead.')
    if (error.code === '54000') throw new FriendCodeError('You have too many friends and requests. Remove some first.')
    throw error
  }
  return data as RequestResult
}
export async function acceptFriendRequest(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.rpc('accept_friend_request', { p_id: id }))
}
// Decline a request, cancel your own, or stop being friends: the row goes, and with it anything shared between you
export async function removeFriendship(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('friendships').delete().eq('id', id))
}
export async function listFriends(sb: SupabaseClient): Promise<Friend[]> {
  return must(await sb.rpc('list_friends')) as Friend[]
}
export async function weekBoard(sb: SupabaseClient, tz: string): Promise<BoardRow[]> {
  return must(await sb.rpc('friends_week_xp', { p_tz: tz })) as BoardRow[]
}

// Sharing: who an item is shared with now, and setting that to a new list of friends
export async function sharesOf(sb: SupabaseClient, kind: ShareKind, itemId: string): Promise<{ id: string; recipient: string }[]> {
  return must(await sb.from('shares').select('id,recipient').eq('kind', kind).eq('item_id', itemId)) as { id: string; recipient: string }[]
}
export async function setSharedWith(sb: SupabaseClient, kind: ShareKind, itemId: string, recipients: string[]): Promise<void> {
  const now = await sharesOf(sb, kind, itemId)
  const add = recipients.filter(r => !now.some(s => s.recipient === r))
  const remove = now.filter(s => !recipients.includes(s.recipient)).map(s => s.id)
  if (add.length) check(await sb.from('shares').insert(add.map(recipient => ({ recipient, kind, item_id: itemId }))))
  if (remove.length) check(await sb.from('shares').delete().in('id', remove))
}
// Stop sharing (the owner) or take it off your list (the friend)
export async function removeShare(sb: SupabaseClient, id: string): Promise<void> {
  check(await sb.from('shares').delete().eq('id', id))
}
export async function sharedWithMe(sb: SupabaseClient): Promise<SharedWithMe[]> {
  return must(await sb.rpc('shared_with_me')) as SharedWithMe[]
}
export async function sharedByMe(sb: SupabaseClient): Promise<SharedByMe[]> {
  return must(await sb.rpc('shared_by_me')) as SharedByMe[]
}
// One shared item, or null when it is no longer shared with you
export async function sharedNote(sb: SupabaseClient, shareId: string): Promise<SharedNote | null> {
  return ((must(await sb.rpc('shared_note', { p_share: shareId })) as SharedNote[])[0]) ?? null
}
export async function sharedDeck(sb: SupabaseClient, shareId: string): Promise<SharedDeck | null> {
  return (must(await sb.rpc('shared_deck', { p_share: shareId })) as SharedDeck | null) ?? null
}
