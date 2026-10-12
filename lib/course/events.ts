'use client'
import { useEffect, useRef } from 'react'

// A course added, renamed, recoloured or deleted says so once it is saved, so the sidebar's course list reads again
export const COURSES_CHANGED = 'studyhub:courses-changed'
export const announceCoursesChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(COURSES_CHANGED)) }

export function useCoursesChanged(react: () => void) {
  const latest = useRef(react)
  useEffect(() => { latest.current = react })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(COURSES_CHANGED, heard)
    return () => window.removeEventListener(COURSES_CHANGED, heard)
  }, [])
}
