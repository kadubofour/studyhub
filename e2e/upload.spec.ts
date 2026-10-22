import { test, expect } from '@playwright/test'
import JSZip from 'jszip'
import { create, signUp } from './helpers'

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const para = (t: string) => `<p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`
async function deck(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?><p:sld ${A} ${P}><p:cSld><p:spTree>${para('Intro to cells')}${para('Cells are the unit of life')}</p:spTree></p:cSld></p:sld>`)
  zip.file('ppt/slides/slide2.xml', `<?xml version="1.0"?><p:sld ${A} ${P}><p:cSld><p:spTree>${para('Organelles')}${para('Mitochondria make ATP')}</p:spTree></p:cSld></p:sld>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('upload a text file and open it on the Flashcards tab', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Upload' }).first().click()
  await expect(page.getByRole('heading', { name: 'Upload material' })).toBeVisible()
  await page.getByLabel('File to upload').setInputFiles({ name: 'enzymes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Enzymes\n\nThey speed up reactions.\n') })
  await expect(page.getByLabel('Title')).toHaveValue('Enzymes')
  await expect(page.getByLabel('Preview').getByText('They speed up reactions.')).toBeVisible()
  await page.getByRole('radio', { name: 'Open with Flashcards' }).check()
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/) // the parameter is used once and dropped
  const study = page.getByRole('complementary', { name: 'Study' })
  await expect(study).toBeVisible()
  await expect(study.getByRole('tab', { name: 'Cards' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Title')).toHaveValue('Enzymes')
})

test('upload a PowerPoint: its slides become sections of a note', async ({ page }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Upload' }).first().click()
  await page.getByLabel('File to upload').setInputFiles({ name: 'week 1.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: await deck() })
  await expect(page.getByLabel('Title')).toHaveValue('Intro to cells')
  const preview = page.getByLabel('Preview')
  await expect(preview.getByRole('heading', { name: 'Slide 1: Intro to cells' })).toBeVisible()
  await expect(preview.getByText('Mitochondria make ATP')).toBeVisible()
  await expect(page.getByText(/Structured by AI/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('complementary', { name: 'Study' })).toHaveCount(0)
})

test('a photo is handed to Scan and a recording to Lectures', async ({ page, isMobile }) => {
  await signUp(page)
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Upload' }).first().click()
  await page.getByLabel('File to upload').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') })
  void isMobile
  await expect(page.getByRole('heading', { name: 'Scan pages' })).toBeVisible()
  await expect(page.getByRole('button', { name: '✦ Scan 1 page' })).toBeVisible() // the photo came with it
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Upload' }).first().click()
  await page.getByLabel('File to upload').setInputFiles({ name: 'talk.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') })
  await expect(page.getByText(/can.t be uploaded yet/)).toBeVisible()
  await page.getByRole('button', { name: 'Go to Lectures' }).click()
  await expect(page).toHaveURL(/\/lectures$/)
})

test('Upload in the Create menu opens the dialog from any page, and a photo goes to Scan', async ({ page }) => {
  await signUp(page)
  await page.goto('/flashcards')
  await create(page, 'Upload')
  await expect(page.getByRole('heading', { name: 'Upload material' })).toBeVisible()
  await page.getByLabel('File to upload').setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') })
  await expect(page.getByRole('heading', { name: 'Scan pages' })).toBeVisible()
  await expect(page.getByRole('button', { name: '✦ Scan 1 page' })).toBeVisible()
})
