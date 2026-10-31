'use client'
import { useEffect, useState } from 'react'
import { Crown, Link2, LogIn, Pencil, Plus, RefreshCw, Trash2, UserMinus, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/profile/Avatar'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { Dialog } from '@/components/ui/Dialog'
import { BTN_ICON } from '@/components/ui/buttonStyles'
import {
  createGroup, deleteGroup, groupMembersOf, joinGroup, leaveGroup, newGroupInvite, removeMember, renameGroup,
  type Group, type GroupMember, type JoinStatus,
} from '@/lib/data/social'
import { inviteLink, inviteToken } from '@/lib/social/links'
import { supabase } from '@/lib/supabase/client'
import { copyText } from './FriendsPanel'
import { Working } from '@/components/ui/Working'

const JOIN: Record<Exclude<JoinStatus, 'ok'>, string> = {
  not_found: 'No group has that invite. It may have been replaced by a new one.',
  group_full: 'That group is full (50 members).',
  rate_limited: 'Too many tries. Try again in an hour.',
}
const ERR: Record<string, string> = {
  rate_limited: 'You have made a lot of groups. Try again in an hour.',
  invalid_name: 'Give the group a name of up to 60 characters.',
  not_owner: 'Only the group\'s owner can do that.',
  not_member: 'You are no longer in that group.',
}
const say = (e: unknown, fallback: string) => (e instanceof Error && ERR[e.message]) || fallback
const nameOf = (n: string | null) => n || 'Student'

// Study groups: make one or join one, and for the group on show, its members and what its owner (or a member) can do.
// `onChange` reloads the groups (and the board) and gives the new list.
export function GroupsPanel({ groups, selected, onSelect, onChange }: {
  groups: Group[]; selected: Group | null; onSelect: (id: string | null) => void; onChange: () => Promise<Group[]>
}) {
  const { profile } = useProfile()
  const toast = useToast()
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<'create' | 'join' | 'rename' | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<{ group: string; list: GroupMember[] } | null>(null)
  const sid = selected?.id ?? null
  const count = selected?.members ?? 0

  useEffect(() => {
    if (!sid) return
    let live = true
    groupMembersOf(supabase(), sid).then(list => { if (live) setMembers({ group: sid, list }) }).catch(() => {})
    return () => { live = false }
  }, [sid, count])
  const list = members && members.group === sid ? members.list : null

  function openDialog(d: 'create' | 'join' | 'rename') { setText(d === 'rename' ? selected?.name ?? '' : ''); setDialog(d) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    const sb = supabase()
    try {
      if (dialog === 'create') {
        const id = await createGroup(sb, t)
        await onChange()
        onSelect(id)
        setDialog(null)
        toast('Group made. Send its invite link to your classmates.')
      } else if (dialog === 'join') {
        const { status, group_id } = await joinGroup(sb, inviteToken(t))
        if (status === 'ok' && group_id) {
          await onChange()
          onSelect(group_id)
          setDialog(null)
          toast('You joined the group.')
        } else toast(JOIN[status as Exclude<JoinStatus, 'ok'>] ?? JOIN.not_found)
      } else if (dialog === 'rename' && selected) {
        await renameGroup(sb, selected.id, t)
        await onChange()
        setDialog(null)
      }
    } catch (err) { toast(say(err, 'Couldn\'t save. Check your connection.')) }
    setBusy(false)
  }

  async function copyInvite(g: Group) {
    if (!g.invite_token) return
    toast(await copyText(inviteLink(window.location.origin, g.invite_token)) ? 'Invite link copied.' : 'Couldn\'t copy the link.')
  }
  async function renewInvite(g: Group) {
    if (!await confirm({ title: 'Make a new invite?', body: 'The current link and code stop working. Members stay in the group.', confirmLabel: 'New invite' })) return
    try { await newGroupInvite(supabase(), g.id); await onChange(); toast('New invite made.') } catch (e) { toast(say(e, 'Couldn\'t make a new invite.')) }
  }
  async function remove(g: Group, m: GroupMember) {
    if (!await confirm({ title: `Remove ${nameOf(m.display_name)}?`, body: `They leave ${g.name} and its board. They can join again with the invite.`, confirmLabel: 'Remove', danger: true })) return
    try { await removeMember(supabase(), g.id, m.user_id); await onChange() } catch (e) { toast(say(e, 'Couldn\'t remove them.')) }
  }
  async function leave(g: Group) {
    if (!await confirm({ title: `Leave ${g.name}?`, body: 'You leave its board. You can join again with an invite.', confirmLabel: 'Leave', danger: true })) return
    try { await leaveGroup(supabase(), g.id); onSelect(null); await onChange() } catch (e) { toast(say(e, 'Couldn\'t leave the group.')) }
  }
  async function deleteIt(g: Group) {
    if (!await confirm({ title: `Delete ${g.name}?`, body: 'The group and its board are gone for everyone in it.', confirmLabel: 'Delete', danger: true })) return
    try { await deleteGroup(supabase(), g.id); onSelect(null); await onChange() } catch (e) { toast(say(e, 'Couldn\'t delete the group.')) }
  }

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className="btn justify-center" onClick={() => openDialog('create')}><Plus size={15} aria-hidden />New group</button>
      <button type="button" className="btn justify-center" onClick={() => openDialog('join')}><LogIn size={15} aria-hidden />Join group</button>
    </div>
  )

  return (
    <div className="space-y-5">
      {selected ? (
        <section aria-label={`About ${selected.name}`} className="card p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="section-label !mb-0 min-w-0 break-words">{selected.name}</h2>
            {selected.is_owner && <button type="button" className={BTN_ICON} aria-label="Rename group" title="Rename" onClick={() => openDialog('rename')}><Pencil size={15} aria-hidden /></button>}
          </div>
          <p className="-mt-1 mb-4 text-sm text-muted">{selected.members} of 50 members{selected.is_owner ? ' · you own it' : ''}</p>
          {selected.is_owner && selected.invite_token && (
            <div className="mb-4 rounded-xl bg-surface p-3.5">
              <div className="text-xs font-medium text-muted">Invite code</div>
              <div className="mt-1 break-all font-mono text-xs leading-relaxed" aria-label="Invite code">{selected.invite_token}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn justify-center" onClick={() => copyInvite(selected)}><Link2 size={15} aria-hidden />Invite link</button>
                <button type="button" className="btn justify-center" onClick={() => renewInvite(selected)}><RefreshCw size={15} aria-hidden />New invite</button>
              </div>
            </div>
          )}
          <h3 className="mb-2 text-sm font-medium">Members</h3>
          {list ? (
            <ul aria-label="Members" className="space-y-2.5">
              {list.map(m => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.display_name} color={m.avatar_color} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{nameOf(m.display_name)}{m.user_id === profile.id && <span className="text-muted"> (you)</span>}</span>
                  {m.is_owner && <Crown size={15} aria-label="Owner" className="shrink-0 text-accent" />}
                  {selected.is_owner && m.user_id !== profile.id && (
                    <button type="button" className={BTN_ICON} aria-label={`Remove ${nameOf(m.display_name)}`} title="Remove from group" onClick={() => remove(selected, m)}><UserMinus size={16} aria-hidden /></button>
                  )}
                </li>
              ))}
            </ul>
          ) : <Working kind="load" size="sm" label="Loading" className="text-sm text-muted" />}
          <div className="mt-5 border-t border-line pt-4">
            {selected.is_owner
              ? <button type="button" className="btn w-full justify-center text-danger" onClick={() => deleteIt(selected)}><Trash2 size={15} aria-hidden />Delete group</button>
              : <button type="button" className="btn w-full justify-center text-danger" onClick={() => leave(selected)}>Leave group</button>}
          </div>
        </section>
      ) : (
        <section aria-label="Study groups" className="card p-5">
          <h2 className="section-label !mb-1">Study groups</h2>
          <p className="mb-4 text-sm text-muted">A board for your class or study circle, up to 50 people.</p>
          {groups.length > 0 && (
            <ul className="mb-4 space-y-1">
              {groups.map(g => (
                <li key={g.id}>
                  <button type="button" onClick={() => onSelect(g.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface pointer-coarse:min-h-11">
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><UsersRound size={15} /></span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{g.name}</span>
                    <span className="shrink-0 text-xs text-muted">{g.members}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {actions}
        </section>
      )}
      {selected && actions}

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} title={dialog === 'create' ? 'New study group' : dialog === 'join' ? 'Join a group' : 'Rename group'}>
        <form onSubmit={submit} className="space-y-4">
          <label className="field"><span>{dialog === 'join' ? 'Invite link or code' : 'Name'}</span>
            <input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={dialog === 'join' ? 300 : 60} autoComplete="off"
              placeholder={dialog === 'join' ? 'Paste the link or code you were sent' : 'Biology 101'} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setDialog(null)}>Cancel</button>
            <button className="btn-primary" disabled={!text.trim() || busy}>{dialog === 'create' ? 'Create' : dialog === 'join' ? 'Join' : 'Save'}</button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
