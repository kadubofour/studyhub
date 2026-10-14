import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

const root = (page: import('@playwright/test').Page) => page.locator('.app-root')
const bg = (page: import('@playwright/test').Page) => root(page).evaluate(el => getComputedStyle(el).backgroundColor)

test('a new student starts on Vivid, with a dark sidebar and a top bar', async ({ page }) => {
  await signUp(page)
  await expect(root(page)).toHaveAttribute('data-look', 'vivid')
  await expect(page.getByRole('banner', { name: 'Today at a glance' })).toBeVisible()
})

test('choose Paper in Settings: the app changes at once, and it is still Paper after a reload', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Classic look' }).click() // new students start on Vivid
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

test('Paper on Home: a serif greeting, until another font is chosen', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Paper look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
  await page.goto('/home')
  await expect(page.getByText('Tasks today')).toBeVisible()
  const greeting = page.getByRole('heading', { level: 1 })
  expect(await greeting.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Lora')
  await page.goto('/settings')
  await page.getByRole('radio', { name: /Rounded/ }).click()
  await page.goto('/home')
  expect(await greeting.evaluate(el => getComputedStyle(el).fontFamily)).not.toContain('Lora')
})

test('Paper is for light mode only: in dark mode it is not offered and the app shows Classic', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Paper look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(root(page)).toHaveAttribute('data-look', 'classic')
  expect(await bg(page)).toBe('rgb(18, 18, 17)') // #121211
  await expect(page.getByRole('radio', { name: 'Paper look' })).toHaveCount(0)
  await page.emulateMedia({ colorScheme: 'light' }) // the choice was kept
  await expect(root(page)).toHaveAttribute('data-look', 'paper')
})

test('Classic has the dark sidebar and the top bar, like Vivid', async ({ page, isMobile }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Classic look' }).click()
  await expect(root(page)).toHaveAttribute('data-look', 'classic')
  await expect(page.getByRole('banner', { name: 'Today at a glance' })).toBeVisible()
  if (!isMobile) {
    const side = await page.locator('.app-sidebar').evaluate(el => getComputedStyle(el).backgroundColor)
    expect(side).toBe('rgb(31, 31, 29)') // #1F1F1D, Classic's own neutral
  }
})
