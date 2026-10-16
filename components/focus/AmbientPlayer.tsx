'use client'
import { useEffect } from 'react'
import { primeAudio } from '@/lib/focus/alert'
import { setAmbientVolume, startAmbient, stopAmbient } from '@/lib/focus/ambient'
import { ambientPrefs, useAmbientPrefs } from '@/lib/focus/ambientPrefs'

// Lives in the app layout, so the background sound carries on when the student moves to another page
export function AmbientPlayer() {
  const { sound, volume } = useAmbientPrefs()

  useEffect(() => {
    if (sound === 'off') { stopAmbient(); return }
    startAmbient(sound, ambientPrefs.get().volume)
    // After a reload a browser will not play sound until something is tapped: the first tap or key press wakes it
    const wake = () => primeAudio()
    document.addEventListener('pointerdown', wake, { once: true })
    document.addEventListener('keydown', wake, { once: true })
    return () => { document.removeEventListener('pointerdown', wake); document.removeEventListener('keydown', wake); stopAmbient() }
  }, [sound])

  useEffect(() => { setAmbientVolume(volume) }, [volume])
  return null
}
