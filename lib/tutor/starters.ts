// Ways to begin a chat and to carry one on, as messages ready to send. Nothing here is sent: the student presses Send.

export interface Starter { id: string; title: string; hint: string; message: string }

export const STARTERS: Starter[] = [
  { id: 'explain', title: 'Explain a topic', hint: 'In plain words, step by step', message: 'Explain this topic to me in plain words: ' },
  { id: 'quiz', title: 'Quiz me', hint: 'A few questions to test myself', message: 'Quiz me on ' },
  { id: 'revise', title: 'Plan my revision', hint: 'What to study, and in what order', message: 'Help me plan my revision for ' },
  { id: 'summarise', title: 'Summarise my notes', hint: 'The key points, short', message: 'Summarise the key points of ' },
]

/** What can be asked after a reply, as the message it sends */
export const FOLLOW_UPS = [
  { id: 'simpler', label: 'Explain it simpler', message: 'Explain that again, in simpler words.' },
  { id: 'example', label: 'Give an example', message: 'Give me a worked example.' },
  { id: 'quiz', label: 'Quiz me on this', message: 'Quiz me on what we just covered.' },
  { id: 'cards', label: 'Make flashcards', message: 'Make flashcards from what we just covered.' },
]

/** The starter's message with what the chat is about filled in, e.g. "Quiz me on Krebs cycle" */
export function starterMessage(s: Starter, about: string | null): string {
  return about ? `${s.message}${s.message.endsWith(' ') ? '' : ' '}${about}` : s.message
}
