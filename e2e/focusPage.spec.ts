import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { signUp } from './helpers'

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const URL_ = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(env)![1].trim()
const SERVICE = /SUPABASE_SERVICE_ROLE_KEY=(.+)/.exec(env)![1].trim()
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }

test('a focus session on a task: pick a length and a task, time runs out with an alert, the task is offered as done, and the session is saved with it', async ({ page, context }) => {
  test.setTimeout(120_000)
  await context.grantPermissions(['notifications'])
  // A stand-in for the browser's notifications, so the test can see what would have been shown
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __notes: string[] }).__notes = seen
    class FakeNotification { static permission = 'granted'; static requestPermission = async () => 'granted'; onclick: unknown = null; constructor(t: string) { seen.push(t) } close() {} }
    ;(window as unknown as { Notification: unknown }).Notification = FakeNotification
  })
  const email = await signUp(page)
  await page.goto('/planner')
  await page.getByLabel('Add a task').fill('Read chapter 7')
  await page.getByLabel('Add a task').press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Mark Read chapter 7 done' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  await page.clock.install()
  // Alerts live in Settings: notifications on (the browser says yes)
  await page.goto('/settings?section=reminders')
  await page.getByRole('switch', { name: 'Notification' }).click()
  await expect(page.getByRole('switch', { name: 'Notification' })).toHaveAttribute('aria-checked', 'true')

  await page.goto('/focus')
  await page.waitForLoadState('networkidle')

  // Length and task
  await page.getByRole('spinbutton', { name: 'Minutes' }).focus()
  await page.keyboard.press('PageUp'); await page.keyboard.press('PageUp') // two steps of five: 25 down to 15
  await expect(page.getByRole('spinbutton', { name: 'Minutes' })).toHaveAttribute('aria-valuenow', '15')
  await page.getByRole('button', { name: /What are you working on/ }).click()
  await page.getByRole('option', { name: /Read chapter 7/ }).click()
  await expect(page.getByRole('button', { name: /Working on/ })).toContainText('Read chapter 7')

  // Start, then the student leaves the page and time runs out
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('spinbutton')).toHaveCount(0) // the drums give way to the countdown: no changing the length now
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }))
  await page.clock.fastForward('15:02')
  await expect(page.getByText('Focus session done. Time for a break.')).toBeVisible()
  await expect(page).toHaveTitle('⏰ Focus session done')
  expect(await page.evaluate(() => (window as unknown as { __notes: string[] }).__notes)).toEqual(['Focus session done'])
  await expect(page.getByRole('tab', { name: 'Short break' })).toHaveAttribute('aria-selected', 'true') // on to the break, waiting to be started

  // Coming back clears the title; the task can be marked done from the message
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page).toHaveTitle('Studyhub')
  await page.getByRole('button', { name: /Mark “Read chapter 7” done/ }).click()
  await expect(page.getByText('Marked “Read chapter 7” done.')).toBeVisible()
  await page.getByRole('tab', { name: 'Focus', exact: true }).click()
  await expect(page.getByRole('button', { name: /What are you working on/ })).toBeVisible() // the task is cleared

  // Saved with the session: the task and its course
  const users = await (await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: admin })).json()
  const uid = users.users.find((u: { email: string }) => u.email === email).id
  const rows = await (await fetch(`${URL_}/rest/v1/focus_sessions?user_id=eq.${uid}&select=minutes,completed,task_id`, { headers: admin })).json()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ minutes: 15, completed: true })
  expect(rows[0].task_id).toBeTruthy()
})

test('Settings remembers the focus alert choices after a reload', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings?section=reminders')
  const auto = page.getByRole('switch', { name: 'Start the next one automatically' })
  await expect(auto).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('switch', { name: 'Sound and vibration' })).toHaveAttribute('aria-checked', 'true')
  await auto.click()
  await page.getByRole('switch', { name: 'Sound and vibration' }).click()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Start the next one automatically' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('switch', { name: 'Sound and vibration' })).toHaveAttribute('aria-checked', 'false')
})

test('the Focus page fits a phone: nothing runs off the side, and the new controls can be tapped', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only')
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('main button, main [role="radio"], main [role="switch"], main [role="tab"]'))
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && !el.classList.contains('sr-only') && r.height < 32 })
    .map(el => el.getAttribute('aria-label') ?? el.textContent?.trim()))
  expect(small).toEqual([])
})
