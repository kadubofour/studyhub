import Link from 'next/link'

export default function Landing() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-medium">Studyhub</h1>
      <p className="max-w-md text-muted">Plan your courses, keep your timetable, take notes, review flashcards, and focus — all in one calm place.</p>
      <div className="flex gap-3">
        <Link href="/signup" className="btn-primary">Get started</Link>
        <Link href="/login" className="btn">Log in</Link>
      </div>
    </main>
  )
}
