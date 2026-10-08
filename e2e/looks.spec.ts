import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

const root = (page: import('@playwright/test').Page) => page.locator('.app-root')
const bg = (page: import('@playwright/test').Page) => root(page).evaluate(el => getComputedStyle(el).backgroundColor)

test('choose Paper in Settings: the app changes at once, and it is still Paper after a reload', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await expect(root(page)).toHaveAttribute('data-look', 'classic')
  const classic = await bg(page)
  await page.getByRole('radio', { name: 'Paper look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
  expect(await bg(page)).toBe('rgb(246, 240, 228)') // #F6F0E4
  expect(await bg(page)).not.toBe(classic)
  await page.reload()
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
  await page.getByRole('radio', { name: 'Classic look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'classic')
  expect(await bg(page)).toBe(classic)
})

test('Paper on Home: tinted tiles and a serif greeting, until another font is chosen', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Paper look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
  await page.goto('/home')
  const tile = page.locator('.tile-a').first()
  await expect(tile).toBeVisible()
  expect(await tile.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(248, 228, 212)') // #F8E4D4
  const greeting = page.getByRole('heading', { level: 1 })
  expect(await greeting.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Lora')
  await page.goto('/settings')
  await page.getByRole('radio', { name: /Rounded/ }).click()
  await page.goto('/home')
  expect(await greeting.evaluate(el => getComputedStyle(el).fontFamily)).not.toContain('Lora')
})

test('Paper in dark mode uses the Paper dark colours', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Paper look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
  expect(await bg(page)).toBe('rgb(28, 25, 21)') // #1C1915
})
