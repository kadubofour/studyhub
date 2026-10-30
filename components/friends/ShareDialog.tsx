'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Avatar } from '@/components/profile/Avatar'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { listFriends, setSharedWith, sharesOf, type Friend, type ShareKind } from '@/lib/data/friends'

const WHAT: Record<ShareKind, string> = { note: 'note', deck: 'deck' }

// Pick which friends can see a note or a deck. They can read it and save their own copy; they cannot change yours.
export function ShareDialog({ open, onClose, kind, itemId, title }: { open: boolean; onClose: () => void; kind: ShareKind; itemId: string; title: string }) {
  const toast = useToast()
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let live = true
    const sb = supabase()
    Promise.all([listFriends(sb), sharesOf(sb, kind, itemId)]).then(([f, s]) => {
      if (!live) return
      setFriends(f.filter(x => x.status === 'accepted'))
      setChosen(new Set(s.map(x => x.recipient)))
      setFailed(false)
    }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [open, kind, itemId])

  async function save() {
    setSaving(true)
    try {
      await setSharedWith(supabase(), kind, itemId, [...chosen])
      toast(chosen.size ? `Shared with ${chosen.size} friend${chosen.size === 1 ? '' : 's'}.` : `Your ${WHAT[kind]} is not shared.`)
      onClose()
    } catch { toast('Couldn\'t share. Try again.') } finally { setSaving(false) }
  }
  const flip = (id: string) => setChosen(c => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <Dialog open={open} onClose={onClose} title={`Share “${title || 'Untitled'}”`} icon={Share2}
      subtitle={`Friends you pick can read this ${WHAT[kind]} and save their own copy. They can't change yours.`}>
      {failed && <p role="alert" className="text-sm text-danger">Couldn&apos;t load your friends. Check your connection.</p>}
      {!failed && friends === null && <p className="text-sm text-muted">Loading…</p>}
      {friends?.length === 0 && (
        <p className="text-sm text-muted">You have no friends on Studyhub yet. <Link href="/friends" className="font-medium text-accent underline underline-offset-2">Add a friend</Link> with their code, then share with them.</p>
      )}
      {!!friends?.length && (
        <ul aria-label="Friends" className="-mx-2 space-y-0.5">
          {friends.map(f => (
            <li key={f.user_id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface">
                <Avatar name={f.display_name} color={f.avatar_color} size={32} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{f.display_name}</span>
                <input type="checkbox" className="accent-[var(--accent-solid)]" checked={chosen.has(f.user_id)} onChange={() => flip(f.user_id)} aria-label={`Share with ${f.display_name}`} />
              </label>
            </li>
          ))}
        </ul>
      )}
      <DialogFooter>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        {!!friends?.length && <button type="button" className="btn-primary" disabled={saving} onClick={() => { void save() }}>{saving ? 'Saving…' : 'Save'}</button>}
      </DialogFooter>
    </Dialog>
  )
}
