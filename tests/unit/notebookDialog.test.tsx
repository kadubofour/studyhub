// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { NotebookNameDialog } from '@/components/notes/NotebookDialogs'

const courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)

describe('naming a notebook', () => {
  it('chooses its course too, starting on the one given, and can have none', () => {
    const onSubmit = vi.fn()
    render(<NotebookNameDialog open onClose={() => {}} title="New notebook" submitLabel="Create" courses={courses} initialCourse="chem" onSubmit={onSubmit} />)
    const d = within(screen.getByRole('dialog', { name: 'New notebook' }))
    expect((d.getByLabelText('Course') as HTMLSelectElement).value).toBe('chem')
    expect([...(d.getByLabelText('Course') as HTMLSelectElement).options].map(o => o.text)).toEqual(['No course', 'Biology', 'Chemistry'])
    fireEvent.change(d.getByLabelText('Name'), { target: { value: 'Organic' } })
    fireEvent.click(d.getByRole('button', { name: 'Create' }))
    expect(onSubmit).toHaveBeenCalledWith('Organic', 'chem')
    fireEvent.change(d.getByLabelText('Course'), { target: { value: '' } })
    fireEvent.click(d.getByRole('button', { name: 'Create' }))
    expect(onSubmit).toHaveBeenLastCalledWith('Organic', null)
  })
  it('asks no course when the student has none', () => {
    render(<NotebookNameDialog open onClose={() => {}} title="New notebook" submitLabel="Create" courses={[]} onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText('Course')).toBeNull()
  })
})
