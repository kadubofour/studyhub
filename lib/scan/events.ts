'use client'
import { useEffect, useRef } from 'react'

// Scan is opened from the app's sidebar, over whatever page is showing. When it saves something,
// it announces it so that page can reload and show the new note, cards or planner items.
export const SCAN_SAVED = 'studyhub:scan-saved'
export const announceScanSaved = () => { window.dispatchEvent(new Event(SCAN_SAVED)) }

// Any page can ask the app to open Scan (the Upload dialog does, for a photo)
export const OPEN_SCAN = 'studyhub:open-scan'
export const requestScan = (files?: File[]) => { window.dispatchEvent(new CustomEvent(OPEN_SCAN, { detail: files })) }
export function useOpenScan(open: (files?: File[]) => void) {
  const latest = useRef(open)
  useEffect(() => { latest.current = open })
  useEffect(() => {
    const heard = (e: Event) => latest.current((e as CustomEvent<File[] | undefined>).detail)
    window.addEventListener(OPEN_SCAN, heard)
    return () => window.removeEventListener(OPEN_SCAN, heard)
  }, [])
}

// Same for Upload: any page can ask the app to open the upload dialog
export const OPEN_UPLOAD = 'studyhub:open-upload'
// It can say where the upload should lead ('tutor': a chat about the new note). Used straight as a click handler it just opens the dialog.
export interface UploadRequest { next?: 'tutor' }
export const requestUpload = (opts?: unknown) => {
  const next = (opts as UploadRequest | undefined)?.next === 'tutor' ? 'tutor' : undefined
  window.dispatchEvent(new CustomEvent(OPEN_UPLOAD, { detail: next ? { next } : undefined }))
}
export function useOpenUpload(open: (opts?: UploadRequest) => void) {
  const latest = useRef(open)
  useEffect(() => { latest.current = open })
  useEffect(() => {
    const heard = (e: Event) => latest.current((e as CustomEvent<UploadRequest | null>).detail ?? undefined)
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
