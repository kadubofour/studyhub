// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { useState } from 'react'
import { Dropdown, courseOptions } from '@/components/ui/Dropdown'

afterEach(cleanup)
const OPTIONS = [{ value: 'ama', label: 'Ama' }, { value: 'kofi', label: 'Kofi' }, { value: 'kwame', label: 'Kwame', disabled: true }, { value: 'yaa', label: 'Yaa' }]
function Pick({ start = 'ama', onChange = () => {} }: { start?: string; onChange?: (v: string) => void }) {
  const [v, setV] = useState(start)
  return <Dropdown label="Friend" value={v} options={OPTIONS} onChange={x => { setV(x); onChange(x) }} />
}
const button = () => screen.getByRole('button', { name: 'Friend' })
const list = () => screen.queryByRole('listbox', { name: 'Friend' })

describe('the dropdown', () => {
  it('shows the chosen option on a button that says it opens a list', () => {
    render(<Pick />)
    expect(button().textContent).toBe('Ama')
    expect(button().getAttribute('aria-haspopup')).toBe('listbox')
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(list()).toBeNull()
  })
  it('opens on a click, ticks the chosen option, and a click on another chooses it and closes', () => {
    const onChange = vi.fn()
    render(<Pick onChange={onChange} />)
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(within(list()!).getByRole('option', { name: 'Ama' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(within(list()!).getByRole('option', { name: 'Yaa' }))
    expect(onChange).toHaveBeenCalledWith('Yaa'.toLowerCase())
    expect(button().textContent).toBe('Yaa')
    expect(list()).toBeNull()
  })
  it('works from the keyboard, skipping an option that cannot be chosen', () => {
    const onChange = vi.fn()
    render(<Pick start="kofi" onChange={onChange} />)
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    expect(button().getAttribute('aria-activedescendant')).toMatch(/-1$/) // opens on the chosen one, Kofi
    fireEvent.keyDown(button(), { key: 'ArrowDown' }) // Kwame cannot be chosen: on to Yaa
    expect(button().getAttribute('aria-activedescendant')).toMatch(/-3$/)
    fireEvent.keyDown(button(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('yaa')
    expect(list()).toBeNull()
  })
  it('Escape closes without choosing; Home and End jump to the ends', () => {
    const onChange = vi.fn()
    render(<Pick onChange={onChange} />)
    fireEvent.keyDown(button(), { key: 'Enter' })
    fireEvent.keyDown(button(), { key: 'End' })
    expect(button().getAttribute('aria-activedescendant')).toMatch(/-3$/)
    fireEvent.keyDown(button(), { key: 'Home' })
    expect(button().getAttribute('aria-activedescendant')).toMatch(/-0$/)
    fireEvent.keyDown(button(), { key: 'Escape' })
    expect(list()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
  it('typing a name jumps to it, even while closed', () => {
    const onChange = vi.fn()
    render(<Pick onChange={onChange} />)
    fireEvent.keyDown(button(), { key: 'y' })
    expect(onChange).toHaveBeenCalledWith('yaa')
  })
  it('a press anywhere else closes it', () => {
    render(<Pick />)
    fireEvent.click(button())
    fireEvent.pointerDown(document.body)
    expect(list()).toBeNull()
  })
  it('shows its prompt while nothing is chosen, and the usual course list starts with No course', () => {
    render(<Dropdown label="Course" value="" placeholder="Pick one" options={courseOptions([{ id: 'c1', name: 'Biology' }], null)} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Course' }).textContent).toBe('Pick one')
    expect(courseOptions([{ id: 'c1', name: 'Biology' }]).map(o => o.label)).toEqual(['No course', 'Biology'])
  })
})
