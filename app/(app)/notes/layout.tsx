import { NotesLayoutShell } from '@/components/notes/NotesLayoutShell'

// "Notes · Studyhub" in the browser tab; the list or the editor is drawn by the shell
export const metadata = { title: 'Notes' }
export default function NotesLayout({ children }: { children: React.ReactNode }) { return <NotesLayoutShell>{children}</NotesLayoutShell> }
