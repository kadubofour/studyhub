// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ChoiceChips } from '@/components/ui/ChoiceChips'

afterEach(cleanup)
const OPTIONS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }]

describe('ChoiceChips', () => {
  it('is a named group of radio buttons with the chosen one checked', () => {
    render(<ChoiceChips label="Greek" value="b" options={OPTIONS} onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Greek' })
    expect(group).toBeTruthy()
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(screen.getByRole('radio', { name: 'Beta' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Alpha' }).getAttribute('aria-checked')).toBe('false')
  })
  it('chooses on click', () => {
    const onChange = vi.fn()
    render(<ChoiceChips label="Greek" value="a" options={OPTIONS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Gamma' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })
  it('moves with the arrow keys, wrapping round, like any radio group', () => {
    const onChange = vi.fn()
    render(<ChoiceChips label="Greek" value="c" options={OPTIONS} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Gamma' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('a')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Gamma' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('b')
  })
  it('has one tab stop: the chosen chip', () => {
    render(<ChoiceChips label="Greek" value="b" options={OPTIONS} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Beta' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('radio', { name: 'Alpha' }).getAttribute('tabindex')).toBe('-1')
  })
  it('with nothing chosen, the first chip takes the tab stop', () => {
    render(<ChoiceChips label="Greek" value="zzz" options={OPTIONS} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Alpha' }).getAttribute('tabindex')).toBe('0')
  })
  it('can show a colour dot on a chip, such as a course colour', () => {
    const { container } = render(<ChoiceChips label="Course" value="x" options={[{ value: 'x', label: 'Biology', color: '#1D9E75' }]} onChange={() => {}} />)
    expect(container.querySelector('[data-dot]')).toBeTruthy()
  })
  it('can be switched off', () => {
    const onChange = vi.fn()
    render(<ChoiceChips label="Greek" value="a" options={OPTIONS} onChange={onChange} disabled />)
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
