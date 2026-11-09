'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { Dialog } from '@/components/ui/Dialog'
import { RenameDialog } from '@/components/ui/RenameDialog'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'
import { deleteCourse, updateCourse } from '@/lib/data/courses'
import { createChat, deleteChat, findChat, renameChat } from '@/lib/data/tutor'
import { announceChatsChanged } from '@/lib/tutor/events'
import { parseEntity, type Entity } from '@/lib/shell/entityLinks'
import { quickActions } from './quickActions'

// Right click (or press and hold) on a link to a note, deck, lecture, course or notebook, anywhere in the app: a menu of what can be done with it.
// Places with a menu of their own (the Library's items, a lecture's row) keep it: this only steps in when nothing else has. Selected text, fields and
// the editor keep the browser's own menu, and so does a right click with Shift held, for a link's native options.
// A course and a chat can also be renamed and deleted from it; each asks first, and the lists read again when it is done.
const KEEPS_NATIVE = 'input, textarea, select, [contenteditable="true"], .ProseMirror, [role="menu"], dialog[open]'

export function QuickActions({ go }: { go: (href: string) => void }) {
  const router = useRouter()
  const path = usePathname()
  const toast = useToast()
  const confirm = useConfirm()
  const [at, setAt] = useState<null | { x: number; y: number; entity: Entity; href: string; title: string }>(null)
  const [renaming, setRenaming] = useState<null | { entity: Entity; name: string }>(null)
  const [deletingCourse, setDeletingCourse] = useState<null | { id: string; name: string }>(null)

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      if (e.defaultPrevented || e.shiftKey || !(e.target instanceof Element) || e.target.closest(KEEPS_NATIVE)) return
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.toString().trim()) return
      const a = e.target.closest('a[href]') as HTMLAnchorElement | null
      if (!a || a.origin !== window.location.origin) return
      const entity = parseEntity(a.pathname)
      if (!entity) return
      e.preventDefault()
      setAt({ x: e.clientX, y: e.clientY, entity, href: a.pathname, title: (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) })
    }
    document.addEventListener('contextmenu', onMenu)
    return () => document.removeEventListener('contextmenu', onMenu)
  }, [])

  const fail = () => toast("Couldn't do that. Check your connection and try again.")
  // A course's or a chat's real name, not whatever the link's words add to it (a card also says how many notes it holds)
  async function nameOf(e: Entity, fallback: string): Promise<string> {
    try {
      const sb = supabase()
      if (e.kind === 'course') return ((await sb.from('courses').select('name').eq('id', e.id).single()).data as { name: string } | null)?.name ?? fallback
      if (e.kind === 'chat') return ((await sb.from('tutor_chats').select('title').eq('id', e.id).single()).data as { title: string } | null)?.title ?? fallback
    } catch { /* the link's own words will do */ }
    return fallback
  }
  // After a deletion: off the page of the thing that is gone
  const leaveIfOn = (href: string, to: string) => { if (path === href) router.replace(to) }

  async function removeChat(e: Entity, title: string) {
    const name = await nameOf(e, title)
    if (!await confirm({ title: 'Delete this chat?', body: `“${name}” and its messages will be deleted.`, confirmLabel: 'Delete', danger: true })) return
    try { await deleteChat(supabase(), e.id); announceChatsChanged(); leaveIfOn(`/tutor/${e.id}`, '/tutor') } catch { toast("Couldn't delete that chat.") }
  }
  async function saveRename(name: string) {
    const r = renaming
    setRenaming(null)
    if (!r) return
    try {
      if (r.entity.kind === 'course') await updateCourse(supabase(), r.entity.id, { name }) // says the courses changed
      else { await renameChat(supabase(), r.entity.id, name); announceChatsChanged() }
    } catch { toast("Couldn't rename that.") }
  }
  async function removeCourse(deleteContents: boolean) {
    const c = deletingCourse
    setDeletingCourse(null)
    if (!c) return
    try { await deleteCourse(supabase(), c.id, { deleteContents }); leaveIfOn(`/courses/${c.id}`, '/courses') } catch { toast("Couldn't delete the course.") }
  }

  const deps = {
    go,
    newTab: (href: string) => { window.open(href, '_blank', 'noopener') },
    copyLink: (href: string) => { navigator.clipboard?.writeText(`${window.location.origin}${href}`).then(() => toast('Link copied.'), fail) },
    askTutor: async (e: Entity, title: string) => {
      try {
        const sb = supabase()
        const chat = e.kind === 'note' ? await findChat(sb, { note_id: e.id }) ?? await createChat(sb, { title: title.slice(0, 200) || 'New chat', note_id: e.id })
          : e.kind === 'lecture' ? await findChat(sb, { lecture_id: e.id }) ?? await createChat(sb, { title: title.slice(0, 200) || 'New chat', lecture_id: e.id })
            : await createChat(sb, { title: (await nameOf(e, title)).slice(0, 200) || 'New chat', course_id: e.id })
        router.push(`/tutor/${chat.id}`)
      } catch { fail() }
    },
    newNote: async (where: { course_id?: string; notebook_id?: string }) => {
      try { go(`/notes/${(await createNote(supabase(), where)).id}`) } catch { toast("Couldn't create a note.") }
    },
    rename: async (e: Entity) => { setRenaming({ entity: e, name: await nameOf(e, at?.title ?? '') }) },
    remove: async (e: Entity) => {
      const title = at?.title ?? ''
      if (e.kind === 'chat') await removeChat(e, title)
      else if (e.kind === 'course') setDeletingCourse({ id: e.id, name: await nameOf(e, title) })
    },
  }
  return (
    <>
      {at && <ContextMenu x={at.x} y={at.y} label={at.title || 'Quick actions'} items={quickActions(at.entity, at.href, at.title, deps)} onClose={() => setAt(null)}
        footer="Shift + right click for the browser's menu" />}
      <RenameDialog open={renaming !== null} title={renaming?.entity.kind === 'course' ? 'Rename course' : 'Rename chat'} initial={renaming?.name ?? ''} maxLength={renaming?.entity.kind === 'course' ? 80 : 200}
        onClose={() => setRenaming(null)} onSave={name => { void saveRename(name) }} />
      <Dialog open={deletingCourse !== null} onClose={() => setDeletingCourse(null)} title={`Delete ${deletingCourse?.name ?? 'course'}?`}>
        <p className="mb-4 text-sm text-muted">Its classes will be removed. What should happen to its tasks, decks and notes?</p>
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => { void removeCourse(false) }}>Keep them (no course)</button>
          <button className="btn text-danger" onClick={() => { void removeCourse(true) }}>Delete its tasks, decks and notes</button>
          <button className="btn-ghost justify-center" onClick={() => setDeletingCourse(null)}>Cancel</button>
        </div>
      </Dialog>
    </>
  )
}
