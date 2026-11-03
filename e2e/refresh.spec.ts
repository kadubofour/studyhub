import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { noteFileAction, signUp, switchToMarkdown, noteSaved, create, listAction, tickOf, moveNoteToNotebook, openNewNotebook } from './helpers'

const fixture = (f: string) => path.join(process.cwd(), 'e2e', 'fixtures', f)

test('accent colour and font apply instantly and survive a reload', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Teal accent' }).click()
  await page.getByRole('radio', { name: /Serif \(Lora\)/ }).click()
  const root = page.locator('.app-root').first()
  await expect(root).toHaveAttribute('style', /--a-solid:\s*#0B7A5E/i)
  await expect(root).toHaveAttribute('style', /--app-font:\s*var\(--font-lora\)/)
  await page.reload()
  await expect(page.locator('.app-root').first()).toHaveAttribute('style', /--a-solid:\s*#0B7A5E/i)
  await expect(page.getByRole('radio', { name: 'Teal accent' })).toHaveAttribute('aria-checked', 'true')
})

test('writing a note is full screen, and Esc goes back to its notebook', async ({ page }) => {
  await signUp(page)
  await page.goto('/library')
  await create(page, 'New note')
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Planner' })).toHaveCount(0) // no app sidebar / tab bar
  await page.getByLabel('Title').fill('Fullscreen')
  await page.getByLabel('Title').press('Escape')
  await expect(page).toHaveURL(/\/notebooks\/[0-9a-f-]{36}$/) // a note made without choosing is in General
  await expect(page.getByRole('link', { name: /Fullscreen/ })).toBeVisible()
})

test('import a Word document with equations, then export it back to Word', async ({ page }) => {

  await signUp(page)
  await page.goto('/library')
  await create(page, 'Upload') // the Create menu has it on a computer and a phone
  await page.getByLabel('File to upload').setInputFiles(fixture('quadratics.docx'))
  await page.getByRole('button', { name: /^Make a note/ }).click() // the file is chosen, then what to do with it
  await expect(page.getByLabel('Title')).toHaveValue('Quadratics')
  const preview = page.getByLabel('Preview')
  await expect(preview.getByRole('heading', { name: 'Formula' })).toBeVisible()
  await expect(preview.locator('.katex').first()).toBeVisible() // equations came back as math
  await expect(preview.getByText('discriminant')).toBeVisible()
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)

  const download = page.waitForEvent('download')
  await noteFileAction(page, 'Export as Word')
  expect((await download).suggestedFilename()).toBe('Quadratics.docx')
})

test('a PDF is structured by AI', async ({ page }) => {
  await signUp(page)
  await page.goto('/library')
  await create(page, 'Upload') // the Create menu has it on a computer and a phone
  await page.getByLabel('File to upload').setInputFiles(fixture('cells.pdf'))
  await page.getByRole('button', { name: /^Make a note/ }).click() // the file is chosen, then what to do with it
  await expect(page.getByText('Check it before saving.')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByLabel('Preview').getByText('Converted by the fake AI.')).toBeVisible()
})

test('a PDF falls back to plain text when the AI cannot convert it', async ({ page }) => {
  await signUp(page)
  await page.goto('/library')
  await create(page, 'Upload') // the Create menu has it on a computer and a phone
  // The E2E fake AI refuses files named "…fallback…"
  await page.getByLabel('File to upload').setInputFiles({ name: 'cells-fallback.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(fixture('cells.pdf')) })
  await page.getByRole('button', { name: /^Make a note/ }).click() // the file is chosen, then what to do with it
  await expect(page.getByText(/only the plain text was kept/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByLabel('Preview').getByText('The Krebs cycle makes ATP.')).toBeVisible()
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('cells-fallback')
})

test('printing from dark mode gives dark text on white paper', async ({ page }) => {

  await signUp(page)
  await page.goto('/library')
  await create(page, 'New note')
  await page.getByLabel('Title').fill('Printable')
  await switchToMarkdown(page)
  await page.getByLabel('Markdown').fill('> a quoted line')
  await noteSaved(page)
  const id = page.url().split('/').pop()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`/print/notes?ids=${id}`)
  await expect(page.locator('blockquote')).toBeVisible() // note loaded
  await page.evaluate(() => { document.documentElement.classList.add('dark'); window.print = () => {} })
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  const colours = await page.evaluate(() => {
    const lum = (c: string) => { const [r, g, b] = c.match(/\d+/g)!.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
    return {
      body: lum(getComputedStyle(document.body).backgroundColor),
      quote: lum(getComputedStyle(document.querySelector('blockquote')!).color),
    }
  })
  expect(colours.body).toBeGreaterThan(0.9) // white paper
  expect(colours.quote).toBeLessThan(0.5) // quoted text dark enough to read on paper
})

test('export a notebook\'s notes as a PDF', async ({ page, context }) => {
  await signUp(page)
  await page.goto('/library')
  await create(page, 'New note')
  await page.getByLabel('Title').fill('Alpha note')
  await noteSaved(page)
  await page.goto('/library')
  await create(page, 'New note')
  await page.getByLabel('Title').fill('Beta note')
  await noteSaved(page)
  // both are in General; a notebook of its own keeps one apart
  await page.goto('/library')
  await openNewNotebook(page)
  const dialog = page.getByRole('dialog', { name: 'New notebook' })
  await dialog.getByLabel('Name').fill('Only beta')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('link', { name: 'General' }).click()
  await page.getByRole('link', { name: /Beta note/ }).click()
  await moveNoteToNotebook(page, 'Only beta')
  await page.goto('/library')
  await page.getByRole('link', { name: 'Only beta' }).click()
  await page.getByRole('button', { name: 'Export notes' }).click()
  const popup = context.waitForEvent('page')
  await page.getByRole('menuitem', { name: 'PDF' }).click()
  const print = await popup
  await print.evaluate(() => { window.print = () => {} }) // keep the dialog from blocking the test
  await expect(print).toHaveURL(/\/print\/notes\?ids=/)
  await expect(print.getByRole('heading', { name: 'Beta note' })).toBeVisible()
  await expect(print.getByRole('heading', { name: 'Alpha note' })).toHaveCount(0)
})
