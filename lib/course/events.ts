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

// A class added, changed or removed (or a course deleted, which takes its classes) says so once it is saved, so the top bar's class chip reads again
export const TIMETABLE_CHANGED = 'studyhub:timetable-changed'
export const announceTimetableChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(TIMETABLE_CHANGED)) }

export function useTimetableChanged(react: () => void) {
  const latest = useRef(react)
  useEffect(() => { latest.current = react })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(TIMETABLE_CHANGED, heard)
    return () => window.removeEventListener(TIMETABLE_CHANGED, heard)
  }, [])
}
