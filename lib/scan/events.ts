'use client'
import { useEffect, useRef } from 'react'

// Scan is opened from the app's sidebar, over whatever page is showing. When it saves something,
// it announces it so that page can reload and show the new note, cards or planner items.
export const SCAN_SAVED = 'studyhub:scan-saved'
export const announceScanSaved = () => { window.dispatchEvent(new Event(SCAN_SAVED)) }

export function useScanSaved(reload: () => void) {
  const latest = useRef(reload)
  useEffect(() => { latest.current = reload })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(SCAN_SAVED, heard)
    return () => window.removeEventListener(SCAN_SAVED, heard)
  }, [])
}
