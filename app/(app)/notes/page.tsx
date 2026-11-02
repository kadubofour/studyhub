import { redirect } from 'next/navigation'

// There is no list of notes: every note is in a notebook, and the notebooks are in the Library
export default function NotesPage() { redirect('/library') }
