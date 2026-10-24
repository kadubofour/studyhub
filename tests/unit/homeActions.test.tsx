// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HomeActions } from '@/components/home/HomeActions'
import { OPEN_QUIZ } from '@/lib/quiz/events'
import { OPEN_UPLOAD } from '@/lib/scan/events'

afterEach(cleanup)

describe('Home quick actions', () => {
  it('are the four tiles: quiz, record a lecture, the tutor and upload', () => {
    render(<HomeActions />)
    const group = screen.getByRole('group', { name: 'Quick actions' })
    expect([...group.querySelectorAll('a, button')].map(e => e.querySelector('span:not([aria-hidden]) > span')?.textContent)).toEqual(['Take a quiz', 'Record lecture', 'Ask the tutor', 'Upload'])
    for (const left of ['New note', 'New deck', 'Scan']) expect(screen.queryByText(left)).toBeNull()
  })

  it('goes to the Tutor with a link', () => {
    render(<HomeActions />)
    expect(screen.getByRole('link', { name: /Ask the tutor/ }).getAttribute('href')).toBe('/tutor')
    expect(screen.getByRole('link', { name: /Record lecture/ }).getAttribute('href')).toBe('/lectures/record')
  })

  it('opens the Upload dialog by asking the app to', () => {
    const upload = vi.fn()
    window.addEventListener(OPEN_UPLOAD, upload)
    render(<HomeActions />)
    fireEvent.click(screen.getByRole('button', { name: /Upload/ }))
    expect(upload).toHaveBeenCalledTimes(1)
    window.removeEventListener(OPEN_UPLOAD, upload)
  })

  it('sit four in a row on wider screens, two on a phone', () => {
    render(<HomeActions />)
    expect(screen.getByRole('group', { name: 'Quick actions' }).className).toContain('grid-cols-2 gap-2.5 md:grid-cols-4')
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
    for (const hint of ['Quiz yourself on a note', 'Record and write it up', 'Get help with a topic', 'A PDF, slides or a file']) expect(screen.getByText(hint)).toBeTruthy()
  })
})

describe('Home quick actions in the accent colour', () => {
  it('are tinted with the accent and have an accent icon, in every look (no per-look neutralising)', () => {
    render(<HomeActions />)
    const tiles = [...screen.getByRole('group', { name: 'Quick actions' }).querySelectorAll('a, button')]
    expect(tiles).toHaveLength(4)
    for (const t of tiles) {
      expect(t.className).toContain('bg-accent-soft')
      expect(t.className).toContain('border-accent')
      expect(t.hasAttribute('data-tint')).toBe(false) // Classic turns data-tint tiles plain
      expect(t.querySelector('span[aria-hidden]')!.className).toContain('bg-accent-solid')
    }
  })
})
