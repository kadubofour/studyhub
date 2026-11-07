'use client'
import { useEffect, useRef } from 'react'

// A chat renamed or deleted from somewhere other than its own page (a right click on the Tutor's list) says so once it is saved, so the list reads again
export const CHATS_CHANGED = 'studyhub:chats-changed'
export const announceChatsChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHATS_CHANGED)) }

export function useChatsChanged(react: () => void) {
  const latest = useRef(react)
  useEffect(() => { latest.current = react })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(CHATS_CHANGED, heard)
    return () => window.removeEventListener(CHATS_CHANGED, heard)
  }, [])
}
