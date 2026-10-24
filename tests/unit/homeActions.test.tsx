// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HomeActions } from '@/components/home/HomeActions'
import { OPEN_QUIZ } from '@/lib/quiz/events'

afterEach(cleanup)

describe('Home quick actions', () => {
  it('has the two things that are nowhere else on a phone: not what the Create button already makes', () => {
    render(<HomeActions />)
    const group = screen.getByRole('group', { name: 'Quick actions' })
    expect([...group.querySelectorAll('a, button')].map(e => e.querySelector('span:not([aria-hidden]) > span')?.textContent)).toEqual(['Take a quiz', 'Ask the tutor'])
    for (const left of ['New note', 'New deck', 'Scan', 'Record lecture', 'Upload']) expect(screen.queryByText(left)).toBeNull()
  })

  it('goes to the Tutor with a link', () => {
    render(<HomeActions />)
    expect(screen.getByRole('link', { name: /Ask the tutor/ }).getAttribute('href')).toBe('/tutor')
  })

  it('opens the Quiz dialog by asking the app to', () => {
    const quiz = vi.fn()
    window.addEventListener(OPEN_QUIZ, quiz)
    render(<HomeActions />)
    fireEvent.click(screen.getByRole('button', { name: /Take a quiz/ }))
    expect(quiz).toHaveBeenCalledTimes(1)
    window.removeEventListener(OPEN_QUIZ, quiz)
  })

  it('says in a few words what each one is for, so the tiles explain themselves', () => {
    render(<HomeActions />)
    for (const hint of ['Quiz yourself on a note', 'Get help with a topic']) expect(screen.getByText(hint)).toBeTruthy()
  })
})

describe('Home quick actions in the accent colour', () => {
  it('are tinted with the accent and have an accent icon, in every look (no per-look neutralising)', () => {
    render(<HomeActions />)
    const tiles = [...screen.getByRole('group', { name: 'Quick actions' }).querySelectorAll('a, button')]
    expect(tiles).toHaveLength(2)
    for (const t of tiles) {
      expect(t.className).toContain('bg-accent-soft')
      expect(t.className).toContain('border-accent')
      expect(t.hasAttribute('data-tint')).toBe(false) // Classic turns data-tint tiles plain
      expect(t.querySelector('span[aria-hidden]')!.className).toContain('bg-accent-solid')
    }
  })
})
