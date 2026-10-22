import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

test('the focus timer can be started over: from the Focus page and from Home, and only once some time has gone', async ({ page }) => {
  test.setTimeout(90_000)
  await signUp(page)
  await page.goto('/focus')
  const restart = page.getByRole('button', { name: 'Restart', exact: true })
  const clock = page.locator('.font-mono.text-5xl')
  await expect(restart).toBeDisabled() // nothing to start over yet
  await expect(page.getByRole('spinbutton', { name: 'Minutes' })).toHaveAttribute('aria-valuenow', '25')

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(clock).not.toHaveText('25:00', { timeout: 10_000 })
  await expect(restart).toBeEnabled()
  await restart.click()
  await expect(clock).toHaveText(/^(25:00|24:59)$/) // back at the full time, and still going
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  // Paused, it starts over paused
  await expect(clock).not.toHaveText('25:00', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await restart.click()
  await expect(page.getByRole('spinbutton', { name: 'Minutes' })).toHaveAttribute('aria-valuenow', '25') // stopped at the full time: the drums are back
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible()

  // Home's timer card has it too once the timer is going
  await page.goto('/home')
  const card = page.getByRole('button', { name: 'Start focus', exact: true })
  await card.click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Restart', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible()
})

test('the Home quick actions are in the accent colour', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'they are on Home on phones; a wider screen has them in the sidebar')
  await signUp(page)
  await page.goto('/home')
  const tile = page.getByRole('group', { name: 'Quick actions' }).getByRole('button', { name: /Take a quiz/ })
  const accent = await page.evaluate(() => { const d = document.createElement('div'); d.className = 'bg-accent-soft'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c })
  expect(await tile.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(accent)
})
