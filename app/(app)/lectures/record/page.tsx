'use client'
import { useState, useSyncExternalStore } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Recorder, type RecorderDeps } from '@/components/lectures/Recorder'
import { speechRecognition } from '@/lib/lectures/liveTranscript'
import { indexedDbStore } from '@/lib/lectures/localStore'
import { partSeconds } from '@/lib/lectures/time'

const noopSubscribe = () => () => {}

// The browser's recording and speech APIs, read once on the client
function browserDeps(): RecorderDeps {
  return {
    getUserMedia: c => navigator.mediaDevices.getUserMedia(c),
    MediaRecorder: typeof MediaRecorder === 'undefined' ? null : (MediaRecorder as unknown as RecorderDeps['MediaRecorder']),
    Recognition: speechRecognition(),
    store: indexedDbStore(),
    partSeconds: partSeconds(),
  }
}

export default function RecordLecturePage() {
  // The server can't know the browser's microphone or speech support (or its date), so the
  // recorder renders only in the browser, after hydration
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  return (
    <div>
      <PageHeader title="Record a lecture" />
      {mounted ? <ClientRecorder /> : <p className="text-sm text-muted">Loading…</p>}
    </div>
  )
}

function ClientRecorder() {
  const [deps] = useState(browserDeps)
  return <Recorder deps={deps} />
}
