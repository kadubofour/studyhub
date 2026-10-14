// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { SettingsRail, SETTINGS_SECTIONS } from '@/components/settings/SettingsRail'

afterEach(cleanup)

describe('SettingsRail', () => {
  it('lists the sections, marking the one shown', () => {
    render(<SettingsRail section="storage" onSection={() => {}} billing />)
    const nav = screen.getByRole('navigation', { name: 'Settings sections' })
    expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['Appearance', 'Plan', 'Storage', 'Your data', 'Account'])
    expect(within(nav).getByRole('button', { name: 'Storage' }).getAttribute('aria-current')).toBe('true')
    expect(within(nav).getByRole('button', { name: 'Appearance' }).getAttribute('aria-current')).toBeNull()
  })
  it('leaves out Plan when payments are not switched on', () => {
    render(<SettingsRail section="appearance" onSection={() => {}} billing={false} />)
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull()
  })
  it('chooses a section', () => {
    const onSection = vi.fn()
    render(<SettingsRail section="appearance" onSection={onSection} billing />)
    fireEvent.click(screen.getByRole('button', { name: 'Your data' }))
    expect(onSection).toHaveBeenCalledWith('data')
  })
  it('knows its section ids', () => {
    expect(SETTINGS_SECTIONS.map(s => s.id)).toEqual(['appearance', 'plan', 'storage', 'data', 'account'])
  })
})
