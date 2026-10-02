// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PasswordField } from '@/components/ui/PasswordField'

afterEach(cleanup)

describe('PasswordField', () => {
  it('hides the password by default and shows it on demand', () => {
    render(<PasswordField label="Password" value="hunter22" onChange={() => {}} autoComplete="current-password" />)
    const input = screen.getByLabelText('Password') as HTMLInputElement
    expect(input.type).toBe('password')
    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('keeps the toggle out of form submission and passes input props through', () => {
    render(<form><PasswordField label="New password" value="" onChange={() => {}} minLength={8} required /></form>)
    const toggle = screen.getByRole('button', { name: 'Show password' }) as HTMLButtonElement
    expect(toggle.type).toBe('button')
    const input = screen.getByLabelText('New password') as HTMLInputElement
    expect(input.minLength).toBe(8)
    expect(input.required).toBe(true)
  })
})
