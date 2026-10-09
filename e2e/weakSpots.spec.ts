import { test, expect, type Page } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

async function menu(page: Page, name: string, item: string) {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await page.getByRole('menu', { name }).locator('[role^="menuitem"]', { hasText: item }).click()
}
async function inBiology(page: Page) {
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH'),
    page.getByLabel('Course').selectOption({ label: 'Biology' }),
  ])
}
const openStudy = async (page: Page) => {
  await page.getByRole('button', { name: '✦ Study' }).click()
  return page.getByRole('complementary', { name: 'Study' })
}
// Wrong on the multiple choice and the true/false, right on the two short answers: 2 of 4
async function quizHalfRight(page: Page, noteUrl: string) {
  await page.goto(noteUrl)
  const study = await openStudy(page)
  await study.getByRole('tab', { name: 'Quiz' }).click()
  await study.getByRole('button', { name: '✦ New quiz' }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: 'Cytoplasm' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'True' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('nadh')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('acetyl coenzyme A')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('2 / 4')).toBeVisible()
}
// Two Biology notes, topics drafted and saved; returns the first note's address
async function topicsSaved(page: Page) {
  await signUp(page)
  await noteWithText(page)
  await inBiology(page)
  const first = page.url()
  await menu(page, 'File', 'New note')
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
  await page.getByLabel('Title').fill('Glycolysis notes')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('Glycolysis splits glucose into two pyruvate molecules in the cytoplasm. '.repeat(4))
  await expect(page.getByText('Saved')).toBeVisible()
  await inBiology(page)
  await page.goto('/progress')
  const topics = page.getByRole('region', { name: 'Topics' })
  await topics.getByRole('button', { name: 'Draft topics' }).click()
  await topics.getByRole('button', { name: 'Save topics' }).click()
  await expect(page.getByText('Topics saved.')).toBeVisible()
  return first
}

test('a weak topic shows on Home, and Revise opens the tutor with the message ready', async ({ page }) => {
  test.setTimeout(150_000)
  const note = await topicsSaved(page)
  await quizHalfRight(page, note)
  await quizHalfRight(page, note)
  await page.goto('/home')
  const card = page.getByRole('region', { name: 'Weak spots' })
  await expect(card.getByRole('listitem', { name: 'Krebs cycle' })).toContainText('8 answers, 50% right in the last 30 days')
  await card.getByRole('button', { name: 'Revise Krebs cycle' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}\?ask=/)
  await expect(page.getByLabel('Message')).toHaveValue('Quiz me on Krebs cycle')
  await expect(page.getByText(/Ask anything/)).toBeVisible() // nothing has been sent
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()
})

test('Home has no Weak spots card when nothing is weak', async ({ page }) => {
  await signUp(page)
  await page.goto('/home')
  await expect(page.getByText('Tasks today')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Weak spots' })).toHaveCount(0)
})
