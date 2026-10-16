// The calm behind the full-screen timer: soft colour drifting slowly, a glow that breathes, and a few specks rising like dust in sunlight.
// Pure CSS (see globals.css), nothing to start or stop, and still for anyone who asked their device to reduce motion.

// Fixed positions: the same on every render, so there is nothing random to differ between the server and the browser
const SPECKS = [
  { left: 6, size: 5, seconds: 26, delay: 0 }, { left: 14, size: 3, seconds: 34, delay: 9 }, { left: 23, size: 6, seconds: 30, delay: 15 },
  { left: 31, size: 4, seconds: 38, delay: 4 }, { left: 40, size: 3, seconds: 28, delay: 21 }, { left: 48, size: 5, seconds: 36, delay: 11 },
  { left: 57, size: 4, seconds: 32, delay: 2 }, { left: 65, size: 6, seconds: 40, delay: 17 }, { left: 73, size: 3, seconds: 29, delay: 7 },
  { left: 81, size: 5, seconds: 35, delay: 13 }, { left: 88, size: 4, seconds: 31, delay: 24 }, { left: 95, size: 3, seconds: 37, delay: 5 },
]

export function ChillBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="chill-blob chill-a left-[-10%] top-[-15%] size-[55vmax]" style={{ background: 'var(--accent-solid)' }} />
      <div className="chill-blob chill-b bottom-[-20%] right-[-10%] size-[50vmax]" style={{ background: 'var(--accent-glow)' }} />
      <div className="chill-blob chill-c left-[30%] top-[40%] size-[38vmax]" style={{ background: 'var(--accent-solid)', opacity: 0.18 }} />
      <div className="chill-breathe absolute left-1/2 top-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/30" />
      {SPECKS.map((s, i) => (
        <span key={i} className="chill-speck" style={{ left: `${s.left}%`, width: s.size, height: s.size, animationDuration: `${s.seconds}s`, animationDelay: `-${s.delay}s` }} />
      ))}
    </div>
  )
}
