import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { signUp, switchToMarkdown } from './helpers'

const CELL = path.join(__dirname, 'fixtures', 'cell.png')

async function newNote(page: Page, title: string) {
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Title').fill(title)
}
async function addCell(page: Page) {
  await page.getByLabel('Choose pictures').setInputFiles(CELL)
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toBeVisible()
  await expect(page.getByText('Saved')).toBeVisible()
}
// The picture's address as it is stored, read from the Markdown editor
async function storedToken(page: Page) {
  await switchToMarkdown(page)
  const md = await page.getByLabel('Markdown').inputValue()
  return md.match(/studyhub-image:[^)\s]+/)?.[0] ?? null
}
async function scribble(page: Page) {
  await page.getByLabel('Picture being marked up').scrollIntoViewIfNeeded()
  const box = (await page.getByLabel('Picture being marked up').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 6 })
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4, { steps: 6 })
  await page.mouse.up()
}

test('add a picture from a file: it shows in the note and is still there after a reload', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Cell notes')
  await addCell(page)
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toHaveAttribute('src', /^https?:\/\//) // shown from a signed link, never the stored name
  await page.reload()
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toBeVisible()
  expect(await storedToken(page)).toMatch(/^studyhub-image:[0-9a-f-]{36}\.webp$/)
})

test('a file that is not a picture is turned away with the reason', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Not a picture')
  await page.getByLabel('Choose pictures').setInputFiles({ name: 'notes.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(page.getByText('Only PNG, JPEG and WebP pictures can go in a note.')).toBeVisible()
  await expect(page.locator('.ProseMirror img')).toHaveCount(0)
})

test('mark up a picture: Done saves it as the note\'s picture, and Cancel changes nothing', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Marked up')
  await addCell(page)
  await page.reload()
  const before = await storedToken(page)
  expect(before).toBeTruthy()
  await page.reload()

  // Cancel leaves the picture as it was
  await page.locator('.ProseMirror img[alt="cell"]').click()
  await page.getByRole('button', { name: 'Markup' }).click()
  const dialog = page.getByRole('group', { name: 'Marking up the picture' })
  await expect(dialog).toBeVisible()
  await scribble(page)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toBeVisible()

  // Done swaps in a new picture, in the same place with the same description
  await page.locator('.ProseMirror img[alt="cell"]').dblclick()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Arrow' }).click()
  await dialog.getByRole('radio', { name: 'Red' }).click()
  await scribble(page)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror img[alt="cell"]')).toBeVisible()
  const after = await storedToken(page)
  expect(after).toMatch(/^studyhub-image:/)
  expect(after).not.toBe(before)
})

test('the Sketch button makes a sketch on a blank page and puts it in the note', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Sketch')
  await page.getByRole('button', { name: 'Sketch' }).click()
  const dialog = page.getByRole('group', { name: 'Marking up the picture' })
  await expect(dialog).toBeVisible()
  await scribble(page)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.ProseMirror img[alt="Drawing"]')).toBeVisible()
  await expect(page.getByText('Saved')).toBeVisible()
})

test('the markup tool has no serious accessibility problems', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'A11y')
  await page.getByRole('button', { name: 'Sketch' }).click()
  await expect(page.getByRole('group', { name: 'Marking up the picture' })).toBeVisible()
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes[0].target.join(' ')}`)).toEqual([])
})

test('a picture shows in the reading view', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Reading')
  await addCell(page)
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Reading mode/ }).click()
  await expect(page.getByRole('article').locator('img[alt="cell"]')).toBeVisible()
})

test('highlight and underline words in a note: they stay after a reload and show in the reading view', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Marked words')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle runs in the matrix')
  await page.keyboard.press('Home')
  await page.keyboard.press('Control+ArrowRight')
  await page.keyboard.press('Control+Shift+ArrowRight') // selects "Krebs "
  await page.getByRole('button', { name: 'Highlight green' }).click()
  await page.getByRole('button', { name: 'Underline' }).click()
  await expect(page.locator('.ProseMirror mark.hl-green')).toContainText('Krebs')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror mark.hl-green')).toContainText('Krebs')
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Reading mode/ }).click()
  await expect(page.getByRole('article').locator('mark.hl-green')).toContainText('Krebs')
  await expect(page.getByRole('article').locator('u')).toContainText('Krebs')
})

// How many pixels of the ink layer have been drawn on
const inkPixels = (page: Page) => page.evaluate(() => {
  const c = document.querySelector('canvas[data-ink]') as HTMLCanvasElement | null
  if (!c || !c.width) return 0
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
  return n
})

test('draw directly on a note: the ink stays where it was drawn after a reload, and the note can still be edited', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Inked')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle runs in the matrix')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('button', { name: 'Draw on note' }).click()
  const bar = page.getByRole('group', { name: 'Draw on the note' })
  await expect(bar).toBeVisible()
  const ink = page.locator('canvas[data-ink]')
  const box = (await ink.boundingBox())!
  await bar.getByRole('radio', { name: 'Blue' }).click()
  await page.mouse.move(box.x + 40, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + 100, { steps: 8 })
  await page.mouse.move(box.x + 120, box.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(200)
  await bar.getByRole('button', { name: 'Done' }).click()
  await expect(bar).toBeHidden()
  await expect(page.getByText('Saved')).toBeVisible()
  const before = await inkPixels(page)
  await page.reload()
  await expect.poll(() => inkPixels(page), { timeout: 20_000 }).toBeGreaterThan(before * 0.6)
  // Not drawing: the note underneath can be typed in again
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type(' and more')
  await expect(page.locator('.ProseMirror')).toContainText('and more')
})

test('ink on a note can be undone and cleared', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Undo ink')
  await page.getByRole('button', { name: 'Draw on note' }).click()
  const bar = page.getByRole('group', { name: 'Draw on the note' })
  await expect(bar).toBeVisible()
  const found = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(found.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes[0].target.join(' ')}`)).toEqual([])
  const box = (await page.locator('canvas[data-ink]').boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 100, { steps: 8 }); await page.mouse.up()
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(100)
  await bar.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => inkPixels(page)).toBe(0)
})
