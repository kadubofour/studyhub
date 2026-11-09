import { BackNavLink } from './BackNavLink'
import { ArrowLeft } from 'lucide-react'

// The way back, to the page the student came from or else to the page above this one, (a notebook to Notes, a deck to Flashcards, a course to Courses), the same everywhere
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <BackNavLink href={href} className="btn-ghost -ml-2.5 mb-4 text-sm" labelBack={<><ArrowLeft size={15} aria-hidden />Back</>}><ArrowLeft size={15} aria-hidden />{children}</BackNavLink>
}
