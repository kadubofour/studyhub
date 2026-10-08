// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanForm } from '@/components/plan/PlanForm'

afterEach(cleanup)
const open = (over: Partial<React.ComponentProps<typeof PlanForm>> = {}) => {
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<PlanForm title="Biology" examLabel="Midterm" saving={false} error={null} onSave={onSave} onCancel={onCancel} {...over} />)
  return { onSave, onCancel }
}

describe('PlanForm', () => {
  it('starts on Balanced, 45 minutes, no days off, and saves those', () => {
    const { onSave } = open()
    expect((screen.getByRole('radio', { name: /Balanced/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Minutes a day') as HTMLInputElement).value).toBe('45')
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(onSave).toHaveBeenCalledWith({ mode: 'balanced', minutesPerDay: 45, daysOff: [] })
  })
  it('describes each mode, and saves the choices', () => {
    const { onSave } = open()
    expect(screen.getByText(/neediest 40%/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Deep dive/ }))
    fireEvent.change(screen.getByLabelText('Minutes a day'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sun' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(onSave).toHaveBeenCalledWith({ mode: 'deep', minutesPerDay: 90, daysOff: [0, 6] })
  })
  it('shows the current settings when editing', () => {
    open({ initial: { mode: 'sprint', minutesPerDay: 30, daysOff: [0] } })
    expect((screen.getByRole('radio', { name: /Sprint/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Minutes a day') as HTMLInputElement).value).toBe('30')
    expect((screen.getByRole('checkbox', { name: 'Sun' }) as HTMLInputElement).checked).toBe(true)
  })
  it('refuses minutes outside 10 to 240 and a week with every day off, saying why', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('Minutes a day'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(screen.getByRole('alert').textContent).toBe('Choose between 10 and 240 minutes.')
    fireEvent.change(screen.getByLabelText('Minutes a day'), { target: { value: '45' } })
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) fireEvent.click(screen.getByRole('checkbox', { name: d }))
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(screen.getByRole('alert').textContent).toBe('Leave at least one day to study.')
    expect(onSave).not.toHaveBeenCalled()
  })
  it('shows a save in progress and an error, and cancels', () => {
    const { onCancel } = open({ saving: true, error: 'Couldn\'t save the plan.' })
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save the plan/)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
