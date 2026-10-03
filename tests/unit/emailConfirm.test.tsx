// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const signUp = vi.fn()
const resend = vi.fn(async () => ({ error: null }))
const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ auth: { signUp, resend, signInWithPassword } }) }))
const router = { replace: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }))

import SignupPage from '@/app/(auth)/signup/page'
import LoginPage from '@/app/(auth)/login/page'

beforeEach(() => { signUp.mockReset(); resend.mockClear(); signInWithPassword.mockReset(); router.replace.mockClear() })
afterEach(cleanup)

async function fillSignup() {
  render(<SignupPage />)
  fireEvent.change(screen.getByLabelText('Email', { exact: true }), { target: { value: 'ama@example.com' } })
  fireEvent.change(screen.getByLabelText('Confirm email'), { target: { value: 'ama@example.com' } })
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'long-enough-1' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create account' })) })
}

describe('sign-up with email confirmation on', () => {
  it('asks the student to check their email, with a link back through the callback to onboarding', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
    await fillSignup()
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy()
    expect(screen.getByText(/ama@example\.com/)).toBeTruthy()
    const opts = signUp.mock.calls[0][0].options as { emailRedirectTo: string }
    expect(opts.emailRedirectTo).toMatch(/\/auth\/callback\?next=%2Fonboarding/)
    expect(router.replace).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resend email' })) })
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'ama@example.com' }))
    expect(screen.getByText('Sent again.')).toBeTruthy()
  })
  it('goes straight to onboarding when no confirmation is needed (local development)', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: { access_token: 't' } }, error: null })
    await fillSignup()
    expect(router.replace).toHaveBeenCalledWith('/onboarding?next=%2Fhome')
  })
})

describe('logging in before confirming', () => {
  it('explains and offers to resend the confirmation email', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ama@example.com' } })
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'long-enough-1' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Log in' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Confirm your email first/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resend confirmation email' })) })
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'ama@example.com' }))
  })
})
