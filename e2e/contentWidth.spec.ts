import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

const mainWidth = (page: import('@playwright/test').Page) => page.locator('main').evaluate(el => el.getBoundingClientRect().width)

test('Content width: Focused, Wide and Full change how much of the screen the pages use, and it is remembered', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has one width')
  await page.setViewportSize({ width: 1700, height: 900 })
  await signUp(page)
  await page.goto('/settings')
  const choose = async (name: string) => { await page.getByRole('radiogroup', { name: 'Content width' }).getByRole('radio', { name }).click() }
  await choose('Focused')
  await page.goto('/progress')
  const focused = await mainWidth(page)
  await page.goto('/settings')
  await choose('Wide')
  await page.goto('/progress')
  const wide = await mainWidth(page)
  await page.goto('/settings')
  await choose('Full')
  await page.goto('/progress')
  const full = await mainWidth(page)
  expect(focused).toBeLessThan(wide)
  expect(wide).toBeLessThan(full)
  await page.reload()
  expect(await mainWidth(page)).toBe(full) // kept
})
