import { User } from 'lucide-react'
import { initials } from '@/lib/profile/avatar'

// The student's initials on their chosen colour. Decorative: their name is always written next to it.
export function Avatar({ name, email, color, size = 40 }: { name: string | null; email?: string | null; color: string; size?: number }) {
  return (
    <span data-testid="avatar" aria-hidden="true" className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials(name, email ?? null) === '?' ? <User size={Math.round(size * 0.5)} aria-hidden /> : initials(name, email ?? null)}
    </span>
  )
}
