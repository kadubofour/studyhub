import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// The way back from a page inside another (a notebook to Notes, a deck to Flashcards, a course to Courses), the same everywhere
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="btn-ghost -ml-2.5 mb-4 text-sm"><ArrowLeft size={15} aria-hidden />{children}</Link>
}
