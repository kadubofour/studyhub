'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { useToast } from '@/components/providers/ToastProvider'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'
import { createChat, findChat } from '@/lib/data/tutor'
import { parseEntity, type Entity } from '@/lib/shell/entityLinks'
import { quickActions } from './quickActions'

// Right click (or press and hold) on a link to a note, deck, lecture, course or notebook, anywhere in the app: a menu of what can be done with it.
// Places with a menu of their own (the Library's items, a lecture's row) keep it: this only steps in when nothing else has. Selected text, fields and
// the editor keep the browser's own menu, and so does a right click with Shift held, for a link's native options.
const KEEPS_NATIVE = 'input, textarea, select, [contenteditable="true"], .ProseMirror, [role="menu"], dialog[open]'

export function QuickActions({ go }: { go: (href: string) => void }) {
  const router = useRouter()
  const toast = useToast()
  const [at, setAt] = useState<null | { x: number; y: number; entity: Entity; href: string; title: string }>(null)

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

  if (!at) return null
  const fail = () => toast("Couldn't do that. Check your connection and try again.")
  const deps = {
    go,
    newTab: (href: string) => { window.open(href, '_blank', 'noopener') },
    copyLink: (href: string) => { navigator.clipboard?.writeText(`${window.location.origin}${href}`).then(() => toast('Link copied.'), fail) },
    askTutor: async (e: Entity, title: string) => {
      try {
        const sb = supabase()
        const chat = e.kind === 'note' ? await findChat(sb, { note_id: e.id }) ?? await createChat(sb, { title: title.slice(0, 200) || 'New chat', note_id: e.id })
          : e.kind === 'lecture' ? await findChat(sb, { lecture_id: e.id }) ?? await createChat(sb, { title: title.slice(0, 200) || 'New chat', lecture_id: e.id })
            : await createChat(sb, { title: title.slice(0, 200) || 'New chat', course_id: e.id })
        router.push(`/tutor/${chat.id}`)
      } catch { fail() }
    },
    newNote: async (where: { course_id?: string; notebook_id?: string }) => {
      try { go(`/notes/${(await createNote(supabase(), where)).id}`) } catch { toast("Couldn't create a note.") }
    },
  }
  return <ContextMenu x={at.x} y={at.y} label={at.title || 'Quick actions'} items={quickActions(at.entity, at.href, at.title, deps)} onClose={() => setAt(null)}
    footer="Shift + right click for the browser's menu" />
}
