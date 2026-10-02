import Link from 'next/link'
import { GraduationCap, CalendarDays, Layers, Timer, NotebookPen } from 'lucide-react'

const FEATURES = [
  { icon: CalendarDays, title: 'Planner and timetable', text: 'Courses, deadlines and your weekly classes in one view.', color: '#7F77DD' },
  { icon: Layers, title: 'Flashcards that space themselves', text: 'Reviews scheduled so you remember for longer.', color: '#D4537E' },
  { icon: Timer, title: 'Focus sessions', text: 'Pomodoro timer, daily goals and streaks.', color: '#1D9E75' },
  { icon: NotebookPen, title: 'Notes with real math', text: 'Rich or Markdown, LaTeX equations, Word and PDF export.', color: '#BA7517' },
]

export default function Landing() {
  return (
    <main className="min-h-dvh px-4 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-glow))' }}>
          <GraduationCap size={28} aria-hidden />
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">Study smarter, all in one place</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">Plan your courses, keep your timetable, take notes, review flashcards and focus, with Studyhub.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary px-5 py-2.5 text-base">Get started</Link>
          <Link href="/login" className="btn px-5 py-2.5 text-base">Log in</Link>
        </div>
      </div>
      <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
        {FEATURES.map(f => (
          <div key={f.title} className="tile flex gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${f.color} 15%, transparent)`, color: f.color }}>
              <f.icon size={20} aria-hidden />
            </span>
            <div>
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted">{f.text}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
