'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { audioUsed } from '@/lib/data/lectures'
import { AUDIO_QUOTA_BYTES, formatMb, storageState } from '@/lib/lectures/time'

export function StorageMessage({ used }: { used: number }) {
  const state = storageState(used)
  if (state === 'ok') return null
  return (
    <p className={`text-sm ${state === 'full' ? 'text-danger' : 'text-muted'}`}>
      {state === 'full' ? 'Lecture storage is full. Delete old lectures to record more.' : 'Lecture storage is nearly full. Delete old lectures you don\'t need.'}
    </p>
  )
}

// Settings → how much lecture audio is stored, of the 300 MB each student has
export function StorageCard() {
  const [used, setUsed] = useState<number | null>(null)
  useEffect(() => { audioUsed(supabase()).then(setUsed).catch(() => {}) }, [])
  if (used == null) return null
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-semibold">Storage</h2>
      <p className="text-sm">{formatMb(used)} of {formatMb(AUDIO_QUOTA_BYTES)} lecture audio used</p>
      <StorageMessage used={used} />
    </section>
  )
}
