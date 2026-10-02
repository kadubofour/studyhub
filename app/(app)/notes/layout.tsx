'use client'
import { usePathname } from 'next/navigation'
import { NotesSidebar } from '@/components/notes/NotesSidebar'

// /notes shows the notes list; /notes/[id] is the full-screen editor (AppShell hides the app chrome too)
export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const editing = usePathname() !== '/notes'
  return editing ? <>{children}</> : <NotesSidebar />
}
