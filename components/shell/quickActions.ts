import { ArrowUpRight, ExternalLink, FilePlus, FileText, FolderPlus, Layers, Link2, ListChecks, MessagesSquare, Mic, Play } from 'lucide-react'
import type { MenuEntry } from '@/components/ui/ContextMenu'
import type { Entity } from '@/lib/shell/entityLinks'

// What a right click on a link to something offers: the same few actions wherever the link is (the sidebar, Home, a list), by what it is.
export type QuickDeps = {
  /** Goes to a page (asks first when that would stop a recording) */
  go: (href: string) => void
  newTab: (href: string) => void
  copyLink: (href: string) => void
  askTutor: (e: Entity, title: string) => void
  newNote: (where: { course_id?: string; notebook_id?: string }) => void
}

export function quickActions(e: Entity, href: string, title: string, d: QuickDeps): MenuEntry[] {
  const open: MenuEntry = { label: e.kind === 'quiz' ? 'Take' : 'Open', icon: ArrowUpRight, onSelect: () => d.go(href) }
  const tab: MenuEntry = { label: 'Open in new tab', icon: ExternalLink, onSelect: () => d.newTab(href) }
  const copy: MenuEntry = { label: 'Copy link', icon: Link2, onSelect: () => d.copyLink(href) }
  const ask: MenuEntry = { label: 'Ask the tutor', icon: MessagesSquare, onSelect: () => d.askTutor(e, title) }
  switch (e.kind) {
    case 'note': return [open, tab, 'sep', ask,
      { label: 'Make flashcards', icon: Layers, onSelect: () => d.go(`${href}?study=cards`) },
      { label: 'Quiz me', icon: ListChecks, onSelect: () => d.go(`${href}?study=quiz`) },
      { label: 'Summarise', icon: FileText, onSelect: () => d.go(`${href}?study=summary`) }, 'sep', copy]
    case 'lecture': return [open, tab, 'sep', ask, 'sep', copy]
    case 'course': return [open, tab, 'sep',
      { label: 'New note here', icon: FilePlus, onSelect: () => d.newNote({ course_id: e.id }) },
      { label: 'New deck here', icon: Layers, onSelect: () => d.go(`/flashcards?new=1&course=${e.id}`) }, ask, 'sep', copy]
    case 'notebook': return [open, tab, 'sep',
      { label: 'New note here', icon: FolderPlus, onSelect: () => d.newNote({ notebook_id: e.id }) },
      { label: 'Record lecture here', icon: Mic, onSelect: () => d.go(`/lectures/record?notebook=${e.id}`) }, 'sep', copy]
    case 'deck': return [open, tab, 'sep', { label: 'Review this deck', icon: Play, onSelect: () => d.go(`/review?deck=${e.id}`) }, 'sep', copy]
    default: return [open, tab, 'sep', copy]
  }
}
