// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ProposalCard } from '@/components/tutor/ProposalCard'
import type { Proposal } from '@/lib/ai/tutorTools'

afterEach(cleanup)
const cards: Proposal = { id: 'p1', tool: 'create_flashcards', state: 'pending', args: { deck_id: null, deck_name: 'Krebs', course_id: null, cards: [{ front: 'Where?', back: 'Matrix' }, { front: 'What?', back: 'NADH' }] } }
const note: Proposal = { id: 'p2', tool: 'create_note', state: 'pending', args: { title: 'Krebs notes', body: '## NADH\nCarries electrons.', course_id: null } }

describe('ProposalCard', () => {
  it('previews the flashcards and adds them as edited', async () => {
    const onAdd = vi.fn(async (_p: Proposal) => {})
    render(<ProposalCard proposal={cards} onAdd={onAdd} onDiscard={() => {}} />)
    expect(screen.getByText('2 flashcards for “Krebs”')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Card 1 front'), { target: { value: 'Where does it run?' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
    expect(onAdd).toHaveBeenCalledTimes(1)
    const sent = onAdd.mock.calls[0][0] as Extract<Proposal, { tool: 'create_flashcards' }>
    expect(sent.args.cards[0]).toEqual({ front: 'Where does it run?', back: 'Matrix' })
  })
  it('previews a note with an editable title', async () => {
    const onAdd = vi.fn(async (_p: Proposal) => {})
    render(<ProposalCard proposal={note} onAdd={onAdd} onDiscard={() => {}} />)
    expect(screen.getByText('Carries electrons.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Better title' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
    expect((onAdd.mock.calls[0][0] as { args: { title: string } }).args.title).toBe('Better title')
  })
  it('discards without adding', () => {
    const onDiscard = vi.fn(), onAdd = vi.fn()
    render(<ProposalCard proposal={note} onAdd={onAdd} onDiscard={onDiscard} />)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
  })
  it('says so and stays pending when adding fails', async () => {
    render(<ProposalCard proposal={note} onAdd={async () => { throw new Error('rls') }} onDiscard={() => {}} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't add that/)
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
  })
  it('shows what was done afterwards, with a link to what was added', () => {
    const { rerender } = render(<ProposalCard proposal={{ ...note, state: 'added', itemId: 'n9', itemKind: 'note' }} onAdd={async () => {}} onDiscard={() => {}} />)
    expect(screen.getByRole('link', { name: /Open/ }).getAttribute('href')).toBe('/notes/n9')
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
    rerender(<ProposalCard proposal={{ ...cards, state: 'added', itemId: 'd9', itemKind: 'deck' }} onAdd={async () => {}} onDiscard={() => {}} />)
    expect(screen.getByRole('link', { name: /Open/ }).getAttribute('href')).toBe('/flashcards/d9')
    rerender(<ProposalCard proposal={{ ...note, state: 'discarded' }} onAdd={async () => {}} onDiscard={() => {}} />)
    expect(screen.getByText('Discarded')).toBeTruthy()
  })
})
