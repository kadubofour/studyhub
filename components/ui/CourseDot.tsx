export function CourseDot({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--line)' }} />
}
