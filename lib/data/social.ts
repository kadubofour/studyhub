import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoardRow } from '@/lib/social/rank'

// Thin wrappers over the friends, groups and leaderboard functions in the database (supabase/migrations/2026111*).
// A raised error comes back with its code as the message ('rate_limited', 'not_owner', 'not_member'...) and is thrown
// as Error(code). The three that answer with a status instead of raising (so a failed try still counts toward its
// limit) return that status.

export type FriendStatus = 'ok' | 'not_found' | 'expired' | 'self' | 'already_friends' | 'rate_limited'
export type JoinStatus = 'ok' | 'not_found' | 'group_full' | 'rate_limited'
export interface Friend { user_id: string; display_name: string | null; avatar_color: string }
export interface FriendRequest { from_id: string; display_name: string | null; avatar_color: string; created_at: string }
export interface Group { id: string; name: string; is_owner: boolean; members: number; /** the owner's only */ invite_token: string | null }
export interface GroupMember { user_id: string; display_name: string | null; avatar_color: string; is_owner: boolean }

type Res<T> = { data: T | null; error: { message: string } | null }
function data<T>(res: Res<T>): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
const one = <T>(rows: T | T[] | null): T | null => (Array.isArray(rows) ? rows[0] ?? null : rows)

// Friends
export const sendFriendRequest = async (sb: SupabaseClient, code: string) =>
  data<FriendStatus>(await sb.rpc('send_friend_request', { p_code: code }))
export const redeemInPerson = async (sb: SupabaseClient, code: string) =>
  data<FriendStatus>(await sb.rpc('redeem_in_person', { p_code: code }))
export async function respondFriendRequest(sb: SupabaseClient, from: string, accept: boolean): Promise<void> {
  data(await sb.rpc('respond_friend_request', { p_from: from, p_accept: accept }))
}
export async function removeFriend(sb: SupabaseClient, other: string): Promise<void> {
  data(await sb.rpc('remove_friend', { p_other: other }))
}
/** A new friend code for the student; the old one stops working */
export const newFriendCode = async (sb: SupabaseClient) => data<string>(await sb.rpc('new_friend_code'))
/** A 6-digit code that makes friends at once, for a few minutes */
export async function startInPerson(sb: SupabaseClient): Promise<{ code: string; expires_at: string }> {
  const row = one(data<{ code: string; expires_at: string } | { code: string; expires_at: string }[]>(await sb.rpc('start_in_person')))
  if (!row) throw new Error('not_found')
  return row
}
export const myFriends = async (sb: SupabaseClient) => data<Friend[]>(await sb.rpc('my_friends')) ?? []
export const myFriendRequests = async (sb: SupabaseClient) => data<FriendRequest[]>(await sb.rpc('my_friend_requests')) ?? []

// Groups
export const createGroup = async (sb: SupabaseClient, name: string) => data<string>(await sb.rpc('create_group', { p_name: name }))
export async function joinGroup(sb: SupabaseClient, token: string): Promise<{ status: JoinStatus; group_id: string | null }> {
  const row = one(data<{ status: JoinStatus; group_id: string | null }[]>(await sb.rpc('join_group', { p_token: token })))
  return row ?? { status: 'not_found', group_id: null }
}
export async function leaveGroup(sb: SupabaseClient, group: string): Promise<void> {
  data(await sb.rpc('leave_group', { p_group: group }))
}
export async function renameGroup(sb: SupabaseClient, group: string, name: string): Promise<void> {
  data(await sb.rpc('rename_group', { p_group: group, p_name: name }))
}
export async function removeMember(sb: SupabaseClient, group: string, user: string): Promise<void> {
  data(await sb.rpc('remove_member', { p_group: group, p_user: user }))
}
/** A new invite for the group; the old one stops working */
export const newGroupInvite = async (sb: SupabaseClient, group: string) => data<string>(await sb.rpc('new_group_invite', { p_group: group }))
export async function deleteGroup(sb: SupabaseClient, group: string): Promise<void> {
  data(await sb.rpc('delete_group', { p_group: group }))
}
export const myGroups = async (sb: SupabaseClient) => data<Group[]>(await sb.rpc('my_groups')) ?? []
export const groupMembersOf = async (sb: SupabaseClient, group: string) => data<GroupMember[]>(await sb.rpc('group_members_of', { p_group: group })) ?? []
export const groupPreview = async (sb: SupabaseClient, token: string) =>
  one(data<{ name: string; members: number }[]>(await sb.rpc('group_preview', { p_token: token })))

// Boards: the student and their friends, or a group's members (unsorted: see rankRows)
export const leaderboard = async (sb: SupabaseClient, group: string | null = null) =>
  data<BoardRow[]>(await sb.rpc('leaderboard', group ? { p_group: group } : {})) ?? []

