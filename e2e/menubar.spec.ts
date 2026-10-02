import { test, expect, type Page } from '@playwright/test'
import { signUp } from './helpers'

async function newNote(page: Page, title: string) {
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Title').fill(title)
}

async function menu(page: Page, name: string, item: string | RegExp) {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await page.getByRole('menu', { name }).locator('[role^="menuitem"]', { hasText: item }).click()
}

test('the password field can be shown and hidden', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  const field = page.getByLabel('Password', { exact: true })
  await field.fill('secret-pass')
  await expect(field).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(field).toHaveAttribute('type', 'password')
})

test('Edit > Insert table adds a table that is saved with the note', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Table note')
  await page.getByLabel('Note', { exact: true }).click()
  await menu(page, 'Edit', 'Insert table')
  const table = page.locator('.ProseMirror table')
  await expect(table).toBeVisible()
  await page.keyboard.type('Organelle')
  await page.getByRole('toolbar', { name: 'Table' }).getByRole('button', { name: 'Add row below' }).click()
  await expect(table.locator('tr')).toHaveCount(4)
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror table th').first()).toHaveText('Organelle')
})

test('typed $…$ becomes an equation, and clicking it opens it for editing', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Maths')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('Area is $\\pi r^2$ ')
  const math = page.locator('.ProseMirror [data-type="inline-math"]')
  await expect(math.locator('.katex')).toBeVisible()
  // A real mouse click: ProseMirror redraws the node on mousedown, which trips locator.click's hit check
  const box0 = (await math.boundingBox())!
  await page.mouse.click(box0.x + box0.width / 2, box0.y + box0.height / 2)
  const box = page.getByLabel('LaTeX')
  await expect(box).toHaveValue('\\pi r^2')
  await box.fill('2\\pi r')
  await page.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Markdown editor' }).click()
  await expect(page.getByLabel('Markdown')).toHaveValue(/\$2\\pi r\$/)
})

test('Edit > Insert equation, reading mode and find', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Cells')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The cell membrane surrounds the cell. ')
  await menu(page, 'Edit', 'Insert equation')
  await page.getByLabel('LaTeX').fill('E = mc^2')
  await expect(page.getByRole('dialog').locator('.katex')).toBeVisible() // live preview
  await page.getByRole('button', { name: 'Insert' }).click()
  await expect(page.locator('.ProseMirror .katex')).toBeVisible()

  await page.keyboard.press('Control+f')
  await page.getByRole('searchbox', { name: 'Find in note' }).fill('cell')
  await expect(page.getByText('1 of 2')).toBeVisible()
  await expect(page.locator('.ProseMirror .find-hit')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Find in note' }).press('Escape')
  await expect(page.locator('.ProseMirror .find-hit')).toHaveCount(0)
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/) // Esc closed find, not the note

  await menu(page, 'View', 'Reading mode')
  await expect(page.getByRole('heading', { name: 'Cells', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveCount(0)
  await expect(page.locator('article .katex').first()).toBeVisible()
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Insert table' })).toHaveAttribute('aria-disabled', 'true')
})

test('File > New note and Delete note', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'First')
  await expect(page.getByText('Saved')).toBeVisible()
  const first = page.url()
  await menu(page, 'File', 'New note')
  await expect(page).not.toHaveURL(first)
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
  page.once('dialog', d => d.accept())
  await menu(page, 'File', 'Delete note')
  await expect(page).toHaveURL(/\/notes$/)
})
