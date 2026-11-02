'use client'
import { useEffect, useRef } from 'react'

// Scan is opened from the app's sidebar, over whatever page is showing. When it saves something,
// it announces it so that page can reload and show the new note, cards or planner items.
export const SCAN_SAVED = 'studyhub:scan-saved'
export const announceScanSaved = () => { window.dispatchEvent(new Event(SCAN_SAVED)) }

// Any page can ask the app to open Scan (the Upload dialog does, for a photo)
export const OPEN_SCAN = 'studyhub:open-scan'
// target: what it should make (a timetable is 'planner'); without one it starts on what the current page holds
export type ScanOpen = { files?: File[]; target?: 'note' | 'cards' | 'planner' }
export const requestScan = (files?: File[], target?: ScanOpen['target']) => { window.dispatchEvent(new CustomEvent<ScanOpen>(OPEN_SCAN, { detail: { files, target } })) }
export function useOpenScan(open: (files?: File[], target?: ScanOpen['target']) => void) {
  const latest = useRef(open)
  useEffect(() => { latest.current = open })
  useEffect(() => {
    const heard = (e: Event) => { const d = (e as CustomEvent<ScanOpen | undefined>).detail; latest.current(d?.files, d?.target) }
    window.addEventListener(OPEN_SCAN, heard)
    return () => window.removeEventListener(OPEN_SCAN, heard)
  }, [])
}

// Same for Upload: any page can ask the app to open the upload dialog
export const OPEN_UPLOAD = 'studyhub:open-upload'
export const requestUpload = () => { window.dispatchEvent(new Event(OPEN_UPLOAD)) }
export function useOpenUpload(open: () => void) {
  const latest = useRef(open)
  useEffect(() => { latest.current = open })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(OPEN_UPLOAD, heard)
    return () => window.removeEventListener(OPEN_UPLOAD, heard)
  }, [])
}

export function useScanSaved(reload: () => void) {
  const latest = useRef(reload)
  useEffect(() => { latest.current = reload })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(SCAN_SAVED, heard)
    return () => window.removeEventListener(SCAN_SAVED, heard)
  }, [])
}
