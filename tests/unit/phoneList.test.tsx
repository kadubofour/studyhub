// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { CardsMark, ChatMark, ChecklistMark, ComposeButton, FileMark, PhoneCount, PhoneGroup, PhoneRow, PhoneTitle, SheetMark, StripMark, tick } from '@/components/ui/PhoneList'

afterEach(cleanup)

describe('the parts of a phone list page', () => {
  it('a title with a ⋯ menu whose current choice is ticked, or Done while selecting', () => {
    const onSort = vi.fn()
    render(<PhoneTitle title="Flashcards" menuLabel="Flashcards options" menu={[tick('Most due', true, () => {}), tick('Name', false, onSort)]} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Flashcards' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Flashcards options' }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Name' }))
    expect(onSort).toHaveBeenCalledTimes(1)
    cleanup()
    const onDone = vi.fn()
    render(<PhoneTitle title="Notes" menuLabel="Notes options" menu={[]} selecting onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  it('rows in a named group: a link with its drawing, title and line, or a tick box while selecting', () => {
    const onToggle = vi.fn()
    render(<PhoneGroup label="Due now">
      <PhoneRow href="/flashcards/d1" title="Cells" mark={<CardsMark />} date="3 due" line="12 cards" />
      <PhoneRow title="Atoms" mark={<CardsMark />} select={{ on: false, onToggle }} />
    </PhoneGroup>)
    const list = screen.getByRole('list', { name: 'Due now' })
    const link = within(list).getByRole('link')
    expect(link.getAttribute('href')).toBe('/flashcards/d1')
    expect(link.textContent).toBe('Cells3 due  12 cards')
    expect(link.querySelector('[data-motif="cards"]')).toBeTruthy()
    fireEvent.click(within(list).getByRole('checkbox', { name: 'Atoms' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
  it('each kind has its own small drawing', () => {
    const { container } = render(<>{[SheetMark, CardsMark, StripMark, ChecklistMark, ChatMark, FileMark].map((M, i) => <M key={i} color="#2b6cb0" />)}</>)
    expect([...container.querySelectorAll('[data-motif]')].map(e => e.getAttribute('data-motif'))).toEqual(['sheets', 'cards', 'strip', 'checklist', 'chat', 'file'])
  })
  it('counts what is listed, and has a round button for a new one, as a link or a button', () => {
    render(<><PhoneCount n={2} one="deck" many="decks" /><ComposeButton label="Record a lecture" icon={() => null} href="/lectures/record" /></>)
    expect(screen.getByText('2 decks')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Record a lecture' }).getAttribute('href')).toBe('/lectures/record')
  })
})
