'use client'
import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Pause, Play } from 'lucide-react'
import { formatClock, locate, type LecturePart } from '@/lib/lectures/time'

/** `seek(t)` plays from lecture time t (seconds); the transcript calls it when a line is tapped */
export type PlayerHandle = { seek: (t: number) => void }

// One player for the whole lecture: it plays the part that holds the current time, switches files
// at part boundaries and preloads the next part so playback doesn't pause between them.
export function LecturePlayer({ urls, parts, duration, onTime, ref }: {
  urls: string[]; parts: LecturePart[]; duration: number; onTime: (t: number) => void; ref?: Ref<PlayerHandle>
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [index, setIndex] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const pendingOffset = useRef<number | null>(null)
  const wasPlaying = useRef(false)

  function go(t: number) {
    const at = locate(parts, t)
    setTime(parts[at.index] ? parts[at.index].start + at.offset : 0)
    if (at.index !== index) { pendingOffset.current = at.offset; setIndex(at.index) }
    else if (audio.current) audio.current.currentTime = at.offset
  }

  useImperativeHandle(ref, () => ({ seek: go }))

  function loaded() {
    const el = audio.current
    if (!el) return
    if (pendingOffset.current != null) { el.currentTime = pendingOffset.current; pendingOffset.current = null }
    if (wasPlaying.current) void el.play()
  }

  function timeupdate() {
    const el = audio.current
    if (!el || !parts[index]) return
    const t = parts[index].start + el.currentTime
    setTime(t)
    onTime(t)
  }

  function ended() {
    if (index + 1 < parts.length) { wasPlaying.current = true; pendingOffset.current = 0; setIndex(index + 1); void Promise.resolve().then(() => audio.current?.play()) }
    else { setPlaying(false); wasPlaying.current = false }
  }

  function toggle() {
    const el = audio.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false); wasPlaying.current = false }
    else { void el.play(); setPlaying(true); wasPlaying.current = true }
  }

  return (
    <div className="card space-y-2">
      <audio ref={audio} data-current src={urls[index]} preload="auto" onLoadedMetadata={loaded} onTimeUpdate={timeupdate} onEnded={ended} />
      {urls[index + 1] && <audio src={urls[index + 1]} preload="auto" aria-hidden />}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary size-10 justify-center rounded-full p-0" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
        <input type="range" aria-label="Position" className="flex-1" min={0} max={Math.max(1, Math.round(duration))} step={1} value={Math.round(time)}
          onChange={e => go(Number(e.target.value))} />
        <span className="text-xs tabular-nums text-muted">{formatClock(time)} / {formatClock(duration)}</span>
      </div>
    </div>
  )
}
