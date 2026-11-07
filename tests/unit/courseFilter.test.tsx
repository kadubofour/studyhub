// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CourseFilter } from '@/components/tutor/CourseFilter'

afterEach(cleanup)
const options = [{ value: '', label: 'All courses', count: 8 }, { value: 'm', label: 'MATH 121', color: '#8b7cf6', count: 5 }, { value: 's', label: 'STAT 111', color: '#e8743b', count: 3 }]

describe('the course filter on the chat list', () => {
  it('is a group of radio buttons, one per course with its count, the chosen one marked', () => {
    render(<CourseFilter label="Show chats from" value="m" options={options} onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Show chats from' })
    expect(group).toBeTruthy()
    expect(screen.getByRole('radio', { name: /MATH 121/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /All courses/ }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('radio', { name: /STAT 111/ }).textContent).toContain('3')
  })
  it('chooses a course on a tap, and moves along with the arrow keys', () => {
    const onChange = vi.fn()
    render(<CourseFilter label="Show chats from" value="" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /STAT 111/ }))
    expect(onChange).toHaveBeenLastCalledWith('s')
    fireEvent.keyDown(screen.getByRole('radio', { name: /All courses/ }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('m')
  })
  it('only the chosen one is in the tab order', () => {
    render(<CourseFilter label="Show chats from" value="s" options={options} onChange={() => {}} />)
    expect(screen.getAllByRole('radio').map(r => r.getAttribute('tabindex'))).toEqual(['-1', '-1', '0'])
  })
})
