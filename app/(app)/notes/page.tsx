import { redirect } from 'next/navigation'

// There is no list of notes: every note is in a notebook, and the notebooks are in their courses
export default function NotesPage() { redirect('/courses') }
