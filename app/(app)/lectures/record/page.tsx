'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Recorder, type RecorderDeps } from '@/components/lectures/Recorder'
import { speechRecognition } from '@/lib/lectures/liveTranscript'
import { indexedDbStore } from '@/lib/lectures/localStore'
import { partSeconds } from '@/lib/lectures/time'

export default function RecordLecturePage() {
  // The browser's recording and speech APIs, read once on the client
  const [deps] = useState<RecorderDeps>(() => ({
    getUserMedia: c => navigator.mediaDevices.getUserMedia(c),
    MediaRecorder: typeof MediaRecorder === 'undefined' ? null : (MediaRecorder as unknown as RecorderDeps['MediaRecorder']),
    Recognition: speechRecognition(),
    store: indexedDbStore(),
    partSeconds: partSeconds(),
  }))
  return (
    <div>
      <PageHeader title="Record a lecture" />
      <Recorder deps={deps} />
    </div>
  )
}
