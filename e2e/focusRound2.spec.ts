import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
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

test('the background sound is remembered, in the app and after a reload', async ({ page, isMobile }) => {
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Rain', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rain', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Volume').fill('0.25')
  // Moving around the app (no reload) and coming back, then a reload: still Rain, same volume
  await page.getByRole('link', { name: 'Planner' }).first().click()
  await expect(page).toHaveURL(/\/planner/)
  // back to Focus without a reload: the sidebar on a computer, Home's Open on a phone (the bottom bar has no Focus)
  if (isMobile) { await page.getByRole('link', { name: 'Home' }).first().click(); await page.getByRole('main').getByRole('link', { name: 'Open', exact: true }).click() }
  else await page.getByRole('link', { name: 'Focus' }).first().click()
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

test('the length can be set to the second, and each kind of session has its own colour without losing contrast', async ({ page }) => {
  await signUp(page)
  await page.goto('/focus')
  await page.waitForLoadState('networkidle')
  const secs = page.getByRole('spinbutton', { name: 'Seconds' })
  await expect(secs).toHaveAttribute('aria-valuenow', '0')
  await secs.focus()
  await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown') // ten seconds
  await expect(page.getByRole('button', { name: 'Back to 25 min' })).toBeVisible()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText(/^25:0[0-9]$|^25:10$|^25:09$/).first()).toBeVisible() // 25:10 counting down

  // Each kind of session is its own colour: read what the button's colour actually is, and check the page for contrast problems
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const button = page.getByRole('main').getByRole('button', { name: /Resume|Start/ }).first()
  const colourOf = () => button.evaluate(b => getComputedStyle(b).backgroundColor)
  const focus = await colourOf()
  // the colour eases from one to the next: wait for it to settle before reading it
  await page.getByRole('tab', { name: 'Short break' }).click()
  await expect.poll(colourOf).not.toBe(focus)
  await page.waitForTimeout(400)
  const short = await colourOf()
  await page.getByRole('tab', { name: 'Long break' }).click()
  await expect.poll(colourOf).not.toBe(short)
  await page.waitForTimeout(400)
  const long = await colourOf()
  expect(new Set([focus, short, long]).size).toBe(3)
  for (const tab of ['Short break', 'Long break', 'Focus']) {
    await page.getByRole('tab', { name: tab }).click()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical'), tab).toEqual([])
  }
})
