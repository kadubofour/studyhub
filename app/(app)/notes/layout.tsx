'use client'
import { usePathname } from 'next/navigation'
import { NotesSidebar } from '@/components/notes/NotesSidebar'

// Desktop: list on the left, editor on the right. Phone: the list at /notes, the editor alone at /notes/[id].
export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const editing = usePathname() !== '/notes'
  return (
    <div className="md:-mx-4 md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
      <aside className={`${editing ? 'hidden md:block' : ''} md:border-r md:border-line md:pr-4`}>
        <NotesSidebar />
      </aside>
      <section className={editing ? '' : 'hidden md:block'}>{children}</section>
    </div>
  )
}
