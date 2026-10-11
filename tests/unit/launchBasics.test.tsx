// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import NotFound from '@/app/not-found'
import ErrorPage from '@/app/error'
import GlobalError from '@/app/global-error'
import nextConfig from '@/next.config'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('404 page', () => {
  it('says the page is missing and offers a way back', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Studyhub' }).getAttribute('href')).toBe('/')
  })
})

describe('error pages', () => {
  it('say something went wrong, keep the work reassuring, and let the student retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const retry = vi.fn()
    render(<ErrorPage error={new Error('boom')} retry={retry} />)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.queryByText('boom')).toBeNull() // the technical message is for the log, not the student
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalled()
  })
  it('the last-resort page brings its own document and a retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const retry = vi.fn()
    // it renders <html>: render into a document fragment host
    const { container } = render(<GlobalError error={new Error('x')} retry={retry} />, { container: document.documentElement })
    void container
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('security headers', () => {
  it('are set on every page: no sniffing, no framing, a short referrer, and the microphone and camera for the app only', async () => {
    const rules = await nextConfig.headers!()
    const all = rules.find(r => r.source === '/:path*')!
    const h = Object.fromEntries(all.headers.map(x => [x.key, x.value]))
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(h['Permissions-Policy']).toContain('microphone=(self)')
    expect(h['Permissions-Policy']).toContain('camera=(self)')
    expect(h['Permissions-Policy']).toContain('geolocation=()')
  })
})

describe('robots and sitemap', () => {
  it('keep private pages and the API out of search, and name the sitemap when the site address is known', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://studyhub.test')
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.allow).toBe('/')
    expect(rule.disallow).toEqual(expect.arrayContaining(['/api/', '/home', '/notes', '/settings']))
    expect(r.sitemap).toBe('https://studyhub.test/sitemap.xml')
  })
  it('lists only the public pages', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://studyhub.test')
    expect(sitemap().map(s => s.url)).toEqual(['https://studyhub.test', 'https://studyhub.test/terms', 'https://studyhub.test/privacy', 'https://studyhub.test/signup', 'https://studyhub.test/login'])
  })
})
