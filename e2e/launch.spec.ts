import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { signUp } from './helpers'

test('the public basics: legal pages, a friendly 404, robots, health and security headers', async ({ page, request }) => {
  const home = await request.get('/')
  expect(home.headers()['x-frame-options']).toBe('DENY')
  expect(home.headers()['x-content-type-options']).toBe('nosniff')
  expect(home.headers()['permissions-policy']).toContain('microphone=(self)')

  await page.goto('/')
  await page.getByRole('link', { name: 'Terms' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Terms' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible()
  await expect(page.getByText(/OpenAI/).first()).toBeVisible()

  await page.goto('/signup')
  await expect(page.getByText(/By creating an account you agree/)).toBeVisible()

  await page.goto('/this-page-does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /home')
  expect(robots).toContain('Disallow: /api/')

  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ ok: true })
})

test('a signed-in page is kept out of search', async ({ page }) => {
  await signUp(page)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('Download my data gives a file with the student\'s own things in it', async ({ page }) => {
  await signUp(page)
  await page.getByLabel('Add a task').fill('Revise the Krebs cycle')
  await page.getByLabel('Add a task').press('Enter')
  await expect(page.getByText('Revise the Krebs cycle')).toBeVisible()
  await page.goto('/settings?section=data')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data' }).click()
  const d = await download
  expect(d.suggestedFilename()).toMatch(/^studyhub-data-\d{4}-\d{2}-\d{2}\.json$/)
  const file = JSON.parse(fs.readFileSync((await d.path())!, 'utf8')) as { app: string; data: { tasks: { title: string }[]; profiles: unknown[] } }
  expect(file.app).toBe('Studyhub')
  expect(file.data.tasks.map(t => t.title)).toEqual(['Revise the Krebs cycle'])
  expect(file.data.profiles).toHaveLength(1)
})

test('Delete my account signs the student out and the sign-in stops working', async ({ page }) => {
  const email = await signUp(page)
  await page.goto('/settings?section=data')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  const confirm = page.getByRole('button', { name: 'Delete everything' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Type DELETE to confirm').fill('DELETE')
  await confirm.click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
  await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
