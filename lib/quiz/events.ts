'use client'
import { useEffect, useRef } from 'react'

// Any page can ask the app to open the Quiz dialog (the sidebar, Home, Library and Flashcards do)
export const OPEN_QUIZ = 'studyhub:open-quiz'
export const requestQuiz = () => { window.dispatchEvent(new Event(OPEN_QUIZ)) }
export function useOpenQuiz(open: () => void) {
  const latest = useRef(open)
  useEffect(() => { latest.current = open })
  useEffect(() => {
    const heard = () => latest.current()
    window.addEventListener(OPEN_QUIZ, heard)
    return () => window.removeEventListener(OPEN_QUIZ, heard)
  }, [])
}
