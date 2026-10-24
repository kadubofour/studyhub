import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { readingMode, signUp, switchToMarkdown } from './helpers'

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

test('a picture can be selected and removed', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Remove')
  await addCell(page)
  await page.locator('.ProseMirror img[alt="cell"]').click()
  await page.getByRole('button', { name: 'Remove picture' }).click()
  await expect(page.locator('.ProseMirror img')).toHaveCount(0)
})

test('a picture shows in the reading view', async ({ page }) => {

  await signUp(page)
  await newNote(page, 'Reading')
  await addCell(page)
  await readingMode(page)
  await expect(page.getByRole('article').locator('img[alt="cell"]')).toBeVisible()
})

test('highlight words in a note: one button, it stays after a reload and shows in the reading view', async ({ page }) => {

  await signUp(page)
  await newNote(page, 'Marked words')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle runs in the matrix')
  await page.keyboard.press('Home')
  await page.keyboard.press('Control+ArrowRight')
  await page.keyboard.press('Control+Shift+ArrowRight') // selects "Krebs "
  await expect(page.getByRole('button', { name: /^Highlight/ })).toHaveCount(1) // a single button: no colours on show
  await page.getByRole('button', { name: 'Highlight', exact: true }).click()
  await expect(page.locator('.ProseMirror mark.hl-yellow')).toContainText('Krebs')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror mark.hl-yellow')).toContainText('Krebs')
  await readingMode(page)
  await expect(page.getByRole('article').locator('mark.hl-yellow')).toContainText('Krebs')
})

// How many pixels of the drawing layer have been drawn on
const inkPixels = (page: Page) => page.evaluate(() => {
  const c = document.querySelector('canvas[data-ink]') as HTMLCanvasElement | null
  if (!c || !c.width) return 0
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
  return n
})

test('draw freehand on a note: the drawing stays after a reload, and the note can still be edited', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Inked')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle runs in the matrix')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('button', { name: 'Draw', exact: true }).click()
  const bar = page.getByRole('group', { name: 'Draw on the note' })
  await expect(bar).toBeVisible()
  const box = (await page.locator('canvas[data-ink]').boundingBox())!
  await bar.getByRole('radio', { name: 'Blue' }).click()
  await page.mouse.move(box.x + 40, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + 100, { steps: 8 })
  await page.mouse.move(box.x + 120, box.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(200)
  await bar.getByRole('button', { name: 'Done' }).dispatchEvent('click') // the dev-only Next.js badge can sit over it on a phone
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

test('the drawing can be undone, and its tools have no serious accessibility problems', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Undo ink')
  await page.getByRole('button', { name: 'Draw', exact: true }).click()
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

test('draw with another brush and a custom thickness, and rub out part of a stroke without taking the whole stroke', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Brushes')
  // Draw sits among the other tools in the editor's toolbar
  await expect(page.getByRole('button', { name: 'Image' })).toBeVisible()
  await page.getByRole('button', { name: 'Draw', exact: true }).click()
  const bar = page.getByRole('group', { name: 'Draw on the note' })
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: 'Marker' }).click()
  await bar.getByRole('slider', { name: 'Thickness' }).fill('18')
  const box = (await page.locator('canvas[data-ink]').boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 320); await page.mouse.down(); await page.mouse.move(box.x + 300, box.y + 320, { steps: 12 }); await page.mouse.up()
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(500)
  const whole = await inkPixels(page)

  // The rubber takes a bite out of the middle: less ink, but not none
  await bar.getByRole('button', { name: 'Rub out' }).click()
  await page.mouse.move(box.x + 170, box.y + 320); await page.mouse.down(); await page.mouse.move(box.x + 190, box.y + 320, { steps: 4 }); await page.mouse.up()
  await expect.poll(() => inkPixels(page)).toBeLessThan(whole * 0.9)
  expect(await inkPixels(page)).toBeGreaterThan(whole * 0.4)

  // One Undo puts the whole rub-out back
  await bar.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(whole * 0.97)

  // The other eraser takes the stroke away completely
  await bar.getByRole('button', { name: 'Erase whole stroke' }).click()
  await page.mouse.click(box.x + 100, box.y + 320)
  await expect.poll(() => inkPixels(page)).toBe(0)
})

test('right-click the Highlight button to change its colour', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Colours')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle runs in the matrix')
  await page.keyboard.press('Home')
  await page.keyboard.press('Control+ArrowRight')
  await page.keyboard.press('Control+Shift+ArrowRight') // selects "Krebs "
  await page.getByRole('button', { name: 'Highlight', exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Pink' }).click()
  await expect(page.locator('.ProseMirror mark.hl-pink')).toContainText('Krebs')
  // The next highlight is pink too
  await page.keyboard.press('End')
  await page.keyboard.press('Control+Shift+ArrowLeft') // selects "matrix"
  await page.getByRole('button', { name: 'Highlight', exact: true }).click()
  await expect(page.locator('.ProseMirror mark.hl-pink')).toHaveCount(2)
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror mark.hl-pink')).toHaveCount(2)
})
