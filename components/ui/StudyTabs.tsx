import Link from 'next/link'

// Flashcards and Quiz are the two ways to practise, so they share one place in the rail: these two tabs go between them
export function StudyTabs({ current, className = 'mb-4' }: { current: 'cards' | 'quiz'; className?: string }) {
  const tabs = [['cards', '/flashcards', 'Flashcards'], ['quiz', '/quiz', 'Quizzes']] as const
  return (
    <nav aria-label="Practice" className={`inline-flex rounded-xl bg-surface p-1 text-[15px] font-medium ${className}`}>
      {tabs.map(([id, href, label]) => (
        <Link key={id} href={href} aria-current={current === id ? 'page' : undefined}
          className={`rounded-lg px-4 py-1.5 transition ${current === id ? 'bg-raised shadow-sm' : 'text-muted hover:text-fg'}`}>{label}</Link>
      ))}
    </nav>
  )
}
