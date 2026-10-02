import { test, expect } from '@playwright/test'
import path from 'node:path'
import { signUp } from './helpers'

const fixture = (f: string) => path.join(process.cwd(), 'e2e', 'fixtures', f)

test('accent colour and font apply instantly and survive a reload', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Teal accent' }).click()
  await page.getByRole('radio', { name: /Serif \(Lora\)/ }).click()
  const root = page.locator('.app-root')
  await expect(root).toHaveAttribute('style', /--a-solid:\s*#0B7A5E/i)
  await expect(root).toHaveAttribute('style', /--app-font:\s*var\(--font-lora\)/)
  await page.reload()
  await expect(page.locator('.app-root')).toHaveAttribute('style', /--a-solid:\s*#0B7A5E/i)
  await expect(page.getByRole('radio', { name: 'Teal accent' })).toHaveAttribute('aria-checked', 'true')
})

test('the sidebar can be hidden and stays hidden after a reload', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones use the bottom tab bar')
  await signUp(page)
  await page.getByRole('button', { name: 'Hide sidebar' }).click()
  await expect(page.getByRole('link', { name: 'Planner' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show sidebar' })).toBeVisible()
  await page.getByRole('button', { name: 'Show sidebar' }).click()
  await expect(page.getByRole('link', { name: 'Planner' })).toBeVisible()
})

test('writing a note is full screen, and Esc goes back to the list', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Planner' })).toHaveCount(0) // no app sidebar / tab bar
  await page.getByLabel('Title').fill('Fullscreen')
  await page.getByLabel('Title').press('Escape')
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByRole('link', { name: /Fullscreen/ })).toBeVisible()
})

test('import a Word document with equations, then export it back to Word', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.getByLabel('File to import').setInputFiles(fixture('quadratics.docx'))
  await expect(page.getByLabel('Title')).toHaveValue('Quadratics')
  const preview = page.getByLabel('Preview')
  await expect(preview.getByRole('heading', { name: 'Formula' })).toBeVisible()
  await expect(preview.locator('.katex').first()).toBeVisible() // equations came back as math
  await expect(preview.getByText('discriminant')).toBeVisible()
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: 'Export' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Word document/ }).click()
  expect((await download).suggestedFilename()).toBe('Quadratics.docx')
})

test('a PDF falls back to plain text when AI import is not configured', async ({ page }) => {
  test.skip(!!process.env.ANTHROPIC_API_KEY, 'AI is configured; this checks the fallback path')
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.getByLabel('File to import').setInputFiles(fixture('cells.pdf'))
  await expect(page.getByText(/only the plain text was kept/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByLabel('Preview').getByText('The Krebs cycle makes ATP.')).toBeVisible()
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('cells')
})

test('select notes and export just those as a PDF', async ({ page, context }) => {
  await signUp(page)
  for (const title of ['Alpha note', 'Beta note']) {
    await page.goto('/notes')
    await page.getByRole('button', { name: /Write your first note|^Note$/ }).first().click()
    await page.getByLabel('Title').fill(title)
    await expect(page.getByText('Saved')).toBeVisible()
  }
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Select' }).click()
  await page.getByRole('checkbox', { name: 'Select Beta note' }).click()
  await page.getByRole('button', { name: 'Export selected' }).click()
  const popup = context.waitForEvent('page')
  await page.getByRole('menuitem', { name: 'PDF' }).click()
  const print = await popup
  await print.evaluate(() => { window.print = () => {} }) // keep the dialog from blocking the test
  await expect(print).toHaveURL(/\/print\/notes\?ids=/)
  await expect(print.getByRole('heading', { name: 'Beta note' })).toBeVisible()
  await expect(print.getByRole('heading', { name: 'Alpha note' })).toHaveCount(0)
})
