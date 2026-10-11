import Link from 'next/link'
import { GraduationCap } from 'lucide-react'

export const LEGAL_UPDATED = '11 October 2026'

// A plain reading page for the Terms and the Privacy notice. The contact address shows only when one is configured.
export function LegalPage({ title, children }: { title: 'Terms' | 'Privacy'; children: React.ReactNode }) {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold"><GraduationCap size={18} aria-hidden />Studyhub</Link>
        <nav aria-label="Legal" className="flex gap-4 text-sm">
          <Link href="/terms" aria-current={title === 'Terms' ? 'page' : undefined} className={title === 'Terms' ? 'font-medium' : 'text-muted hover:text-fg'}>Terms</Link>
          <Link href="/privacy" aria-current={title === 'Privacy' ? 'page' : undefined} className={title === 'Privacy' ? 'font-medium' : 'text-muted hover:text-fg'}>Privacy</Link>
        </nav>
      </header>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
      {email && <p className="mt-8 border-t border-line pt-4 text-sm">Questions? Write to <a className="text-accent" href={`mailto:${email}`}>{email}</a>.</p>}
    </main>
  )
}
