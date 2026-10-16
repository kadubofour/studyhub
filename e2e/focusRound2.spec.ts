import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

test('keyboard shortcuts and full screen on the Focus page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a keyboard')
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.keyboard.press('f')
  const view = page.getByRole('dialog', { name: 'Full screen timer' })
  await expect(view).toBeVisible()
  await expect(view.getByText(/^2[45]:\d\d$/)).toBeVisible()
  await view.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(view.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(view).toBeHidden()
  await page.keyboard.press('r')
  await expect(page.getByRole('spinbutton', { name: 'Minutes' })).toHaveAttribute('aria-valuenow', '25') // started over, stopped: the drums are back
})

test('the background sound is remembered, in the app and after a reload', async ({ page }) => {
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Rain', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rain', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Volume').fill('0.25')
  // Moving around the app (no reload) and coming back, then a reload: still Rain, same volume
  await page.getByRole('link', { name: 'Planner' }).first().click()
  await expect(page).toHaveURL(/\/planner/)
  await page.getByRole('link', { name: 'Focus' }).first().click()
  await expect(page.getByRole('button', { name: 'Rain', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Rain', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Volume')).toHaveValue('0.25')
  await page.getByRole('button', { name: 'Off', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('the running ring fills a phone screen, and nothing runs off the side', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone')
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  const ring = await page.locator('main svg.-rotate-90').boundingBox()
  const width = page.viewportSize()!.width
  expect(ring!.width).toBeGreaterThan(width * 0.8)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
