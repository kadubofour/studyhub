'use client'
import { useEffect } from 'react'
import Link from 'next/link'

// Something broke while showing a page. The technical detail goes to the log (Vercel shows it), never to the student.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-muted">Your work is saved. Try again, and if it keeps happening, come back in a few minutes.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => retry()}>Try again</button>
        <Link href="/" className="btn">Go to Studyhub</Link>
      </div>
    </main>
  )
}
