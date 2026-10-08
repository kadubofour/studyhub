// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TopicEditor } from '@/components/progress/TopicEditor'
import type { CourseMaterial, TopicDraft } from '@/lib/topics/types'

afterEach(cleanup)
const material: CourseMaterial = { notes: [{ id: 'n1', title: 'Krebs notes' }, { id: 'n2', title: 'Glyco notes' }], lectures: [{ id: 'l1', title: 'Week 3 lecture' }], decks: [{ id: 'd1', name: 'Cells deck' }] }
const initial = (): TopicDraft[] => [
  { id: 't1', name: 'Krebs cycle', links: [{ kind: 'note', id: 'n1' }] },
  { id: 't2', name: 'Glycolysis', links: [{ kind: 'note', id: 'n2' }, { kind: 'lecture', id: 'l1' }] },
]
const open = (over: Partial<React.ComponentProps<typeof TopicEditor>> = {}) => {
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<TopicEditor initial={initial()} material={material} fresh={false} saving={false} error={null} onSave={onSave} onCancel={onCancel} {...over} />)
  return { onSave, onCancel }
}
const saved = (onSave: ReturnType<typeof vi.fn>) => onSave.mock.calls[0][0] as TopicDraft[]

describe('TopicEditor', () => {
  it('shows each topic with its linked material by name', () => {
    open()
    expect((screen.getByLabelText('Topic 1 name') as HTMLInputElement).value).toBe('Krebs cycle')
    // shown as linked chips (the same names are also offered to the other topic in its Add list)
    expect(screen.getByRole('button', { name: 'Remove Krebs notes from Krebs cycle' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Week 3 lecture from Glycolysis' })).toBeTruthy()
  })
  it('renames a topic and saves the list with its ids', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('Topic 2 name'), { target: { value: '  Glycolysis and fermentation ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save topics' }))
    expect(saved(onSave)).toEqual([
      { id: 't1', name: 'Krebs cycle', links: [{ kind: 'note', id: 'n1' }] },
      { id: 't2', name: 'Glycolysis and fermentation', links: [{ kind: 'note', id: 'n2' }, { kind: 'lecture', id: 'l1' }] },
    ])
  })
  it('adds, moves and deletes topics', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('New topic name'), { target: { value: 'Electron transport' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add topic' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Electron transport up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Krebs cycle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save topics' }))
    expect(saved(onSave).map(t => t.name)).toEqual(['Electron transport', 'Glycolysis'])
  })
  it('merges one topic into another, keeping both topics\' material', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('Merge Glycolysis into'), { target: { value: 't1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save topics' }))
    const [only] = saved(onSave)
    expect(saved(onSave)).toHaveLength(1)
    expect(only.id).toBe('t1')
    expect(only.links).toEqual([{ kind: 'note', id: 'n1' }, { kind: 'note', id: 'n2' }, { kind: 'lecture', id: 'l1' }])
  })
  it('links and unlinks material, offering only what is not linked yet', () => {
    const { onSave } = open()
    const add = screen.getByLabelText('Add to Krebs cycle') as HTMLSelectElement
    expect([...add.options].map(o => o.textContent)).not.toContain('Krebs notes')
    fireEvent.change(add, { target: { value: 'deck:d1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Week 3 lecture from Glycolysis' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save topics' }))
    expect(saved(onSave)[0].links).toEqual([{ kind: 'note', id: 'n1' }, { kind: 'deck', id: 'd1' }])
    expect(saved(onSave)[1].links).toEqual([{ kind: 'note', id: 'n2' }])
  })
  it('does not save a duplicate or empty name, and says why', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('Topic 2 name'), { target: { value: ' krebs cycle ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save topics' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Two topics have the same name.')
    fireEvent.change(screen.getByLabelText('Topic 2 name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save topics' }))
    expect(screen.getByRole('alert').textContent).toBe('Every topic needs a name.')
  })
  it('says a draft is not saved yet, shows a save in progress and an error, and cancels', () => {
    const { onCancel } = open({ fresh: true, saving: true, error: 'Couldn\'t save. Your changes are still here; try again.' })
    expect(screen.getByRole('status').textContent).toMatch(/Drafted by AI.*Nothing is saved until you press Save/)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save/)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
