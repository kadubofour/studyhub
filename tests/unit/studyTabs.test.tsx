// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StudyTabs } from '@/components/ui/StudyTabs'
import { MORE_PLACES, PLACES, isActive } from '@/lib/shell/nav'

afterEach(cleanup)

describe('StudyTabs', () => {
  it('links Flashcards and Quizzes, and marks the one you are on', () => {
    render(<StudyTabs current="quiz" />)
    expect(screen.getByRole('link', { name: 'Flashcards' }).getAttribute('href')).toBe('/flashcards')
    expect(screen.getByRole('link', { name: 'Quizzes' }).getAttribute('href')).toBe('/quiz')
    expect(screen.getByRole('link', { name: 'Quizzes' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Flashcards' }).getAttribute('aria-current')).toBeNull()
  })
})

describe('Quiz in the rail', () => {
  it('has no place of its own, but is still found by search and lights up Flashcards', () => {
    expect(PLACES.some(p => p.href === '/quiz')).toBe(false)
    expect(MORE_PLACES.some(p => p.href === '/quiz')).toBe(true)
    expect(isActive('/quiz', '/flashcards')).toBe(true)
    expect(isActive('/quiz/abc', '/flashcards')).toBe(true)
    expect(isActive('/flashcards', '/flashcards')).toBe(true)
  })
})
