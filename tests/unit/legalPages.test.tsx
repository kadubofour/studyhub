// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import TermsPage from '@/app/terms/page'
import PrivacyPage from '@/app/privacy/page'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('Privacy page', () => {
  it('says what is kept and who else handles it, including the AI and payment providers', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeTruthy()
    for (const name of ['OpenAI', 'Supabase', 'Vercel', 'Paystack', 'YouTube']) expect(screen.getAllByText(new RegExp(name)).length, name).toBeGreaterThan(0)
  })
  it('tells students they can download or delete everything, in Settings', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/Settings/).length).toBeGreaterThan(0)
    expect(screen.getByText(/download/i)).toBeTruthy()
    expect(screen.getAllByText(/delete/i).length).toBeGreaterThan(0)
  })
  it('says no advertising or tracking cookies are used', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/no advertising/i).length).toBeGreaterThan(0)
  })
  it('shows the contact address only when one is set', () => {
    render(<PrivacyPage />)
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull()
    cleanup()
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'help@studyhub.test')
    render(<PrivacyPage />)
    expect(screen.getByRole('link', { name: 'help@studyhub.test' }).getAttribute('href')).toBe('mailto:help@studyhub.test')
  })
  it('has a date and a link to the terms and back to the start', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/Last updated/)).toBeTruthy()
    expect(within(screen.getByRole('navigation', { name: 'Legal' })).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: /Studyhub/ }).getAttribute('href')).toBe('/')
  })
})

describe('Terms page', () => {
  it('covers content ownership, AI mistakes, billing and cancelling, and honest use', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeTruthy()
    for (const re of [/your content/i, /AI can be wrong|AI answers can be wrong/i, /Premium/, /turn off renewal/i, /school/i]) expect(screen.getAllByText(re).length, String(re)).toBeGreaterThan(0)
  })
  it('links to the privacy page', () => {
    render(<TermsPage />)
    expect(within(screen.getByRole('navigation', { name: 'Legal' })).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
  })
})
