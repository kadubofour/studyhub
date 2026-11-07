import { describe, it, expect, vi } from 'vitest'
import { parseEntity } from '@/lib/shell/entityLinks'
import { quickActions, type QuickDeps } from '@/components/shell/quickActions'

const ID = '11111111-1111-4111-8111-111111111111'

describe('what a path is the page of', () => {
  it.each([['notes', 'note'], ['flashcards', 'deck'], ['lectures', 'lecture'], ['courses', 'course'], ['notebooks', 'notebook'], ['tutor', 'chat'], ['quiz', 'quiz'], ['files', 'file']])('/%s/<id> is a %s', (seg, kind) => {
    expect(parseEntity(`/${seg}/${ID}`)).toEqual({ kind, id: ID })
  })
  it('ignores a query, a hash and a closing slash', () => {
    expect(parseEntity(`/notes/${ID}?study=cards`)).toEqual({ kind: 'note', id: ID })
    expect(parseEntity(`/courses/${ID}/`)).toEqual({ kind: 'course', id: ID })
    expect(parseEntity(`/lectures/${ID}#t=10`)).toEqual({ kind: 'lecture', id: ID })
  })
  it('is null for anything else: lists, pages that are not one thing, and ids that are not ids', () => {
    for (const p of ['/notes', '/home', '/lectures/record', '/courses/none', `/flashcards/${ID}/play`, '/notes/abc', `/api/notes/${ID}`, '/'] ) expect(parseEntity(p), p).toBeNull()
  })
})

const deps = (): QuickDeps => ({ go: vi.fn(), newTab: vi.fn(), copyLink: vi.fn(), askTutor: vi.fn(), newNote: vi.fn() })
const labels = (kind: Parameters<typeof quickActions>[0]['kind']) => quickActions({ kind, id: ID }, `/x/${ID}`, 'T', deps()).filter(e => e !== 'sep').map(e => (e as { label: string }).label)
const run = (kind: Parameters<typeof quickActions>[0]['kind'], label: string, d: QuickDeps) => (quickActions({ kind, id: ID }, `/x/${ID}`, 'T', d).find(e => e !== 'sep' && e.label === label) as { onSelect: () => void }).onSelect()

describe('what a right click on a link offers', () => {
  it('every kind can be opened, opened in a new tab and have its link copied', () => {
    for (const k of ['note', 'deck', 'lecture', 'course', 'notebook', 'chat', 'quiz', 'file'] as const) {
      expect(labels(k), k).toEqual(expect.arrayContaining([k === 'quiz' ? 'Take' : 'Open', 'Open in new tab', 'Copy link']))
    }
  })
  it('a note: ask the tutor, make flashcards, quiz me, summarise', () => {
    expect(labels('note')).toEqual(expect.arrayContaining(['Ask the tutor', 'Make flashcards', 'Quiz me', 'Summarise']))
    const d = deps(); run('note', 'Quiz me', d)
    expect(d.go).toHaveBeenCalledWith(`/x/${ID}?study=quiz`)
  })
  it('a course: a note or deck made in it, and the tutor about it', () => {
    expect(labels('course')).toEqual(expect.arrayContaining(['New note here', 'New deck here', 'Ask the tutor']))
    const d = deps(); run('course', 'New note here', d); run('course', 'New deck here', d)
    expect(d.newNote).toHaveBeenCalledWith({ course_id: ID })
    expect(d.go).toHaveBeenCalledWith(`/flashcards?new=1&course=${ID}`)
  })
  it('a notebook: a note or a recording made in it', () => {
    const d = deps(); run('notebook', 'New note here', d); run('notebook', 'Record lecture here', d)
    expect(d.newNote).toHaveBeenCalledWith({ notebook_id: ID })
    expect(d.go).toHaveBeenCalledWith(`/lectures/record?notebook=${ID}`)
  })
  it('a deck: review it. A lecture: ask the tutor. Nothing destructive anywhere.', () => {
    const d = deps(); run('deck', 'Review this deck', d)
    expect(d.go).toHaveBeenCalledWith(`/review?deck=${ID}`)
    expect(labels('lecture')).toContain('Ask the tutor')
    for (const k of ['note', 'deck', 'lecture', 'course', 'notebook', 'chat', 'quiz', 'file'] as const) expect(labels(k).join('|')).not.toMatch(/delete|remove/i)
  })
})
