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
async function secondNote(page: Page, title: string, text: string) {
  await menu(page, 'File', 'New note')
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type(text.repeat(4))
  await expect(page.getByText('Saved')).toBeVisible()
  await inBiology(page)
}
// Two Biology notes, then draft and save topics on Progress; returns the first note's address
async function topicsSaved(page: Page) {
  await signUp(page)
  await noteWithText(page)
  await inBiology(page)
  const first = page.url()
  await secondNote(page, 'Glycolysis notes', 'Glycolysis splits glucose into two pyruvate molecules in the cytoplasm. ')
  await page.goto('/progress')
  const topics = page.getByRole('region', { name: 'Topics' })
  await topics.getByRole('button', { name: 'Draft topics' }).click()
  await expect(topics.getByText(/Nothing is saved until you press Save/)).toBeVisible()
  await expect(topics.getByLabel('Topic 2 name')).toHaveValue('Glycolysis')
  await topics.getByLabel('Topic 2 name').fill('Glycolysis and fermentation')
  await topics.getByRole('button', { name: 'Save topics' }).click()
  await expect(page.getByText('Topics saved.')).toBeVisible()
  return first
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

test('draft topics from two notes, rename one, save, and still see them after a reload', async ({ page }) => {
  await topicsSaved(page)
  await page.reload()
  const topics = page.getByRole('region', { name: 'Topics' })
  await expect(topics.getByRole('listitem', { name: 'Krebs cycle' })).toContainText('Not started')
  await expect(topics.getByRole('listitem', { name: 'Glycolysis and fermentation' })).toContainText('1 note')
  await expect(topics.getByRole('listitem', { name: 'Krebs cycle' })).toContainText('2 notes')
})

test('wrong quiz answers turn a topic weak with its numbers, and Update topics adds only what is new', async ({ page }) => {
  test.setTimeout(150_000)
  const note = await topicsSaved(page)
  await quizHalfRight(page, note)
  await quizHalfRight(page, note)
  await page.goto('/progress')
  const topics = page.getByRole('region', { name: 'Topics' })
  await expect(topics.getByRole('region', { name: 'Weak spots' })).toContainText('Krebs cycle')
  await expect(topics.getByRole('listitem', { name: 'Krebs cycle' })).toContainText('8 answers, 50% right in the last 30 days')
  await expect(topics.getByRole('listitem', { name: 'Krebs cycle' })).toContainText('Weak')
  // New material in the course
  await page.goto(note)
  await secondNote(page, 'Pyruvate notes', 'Pyruvate is converted to acetyl-CoA before it enters the cycle in the matrix. ')
  await page.goto('/progress')
  await topics.getByRole('button', { name: 'Update topics' }).click()
  await expect(topics.getByLabel('Topic 3 name')).toHaveValue('Pyruvate')
  await expect(topics.getByLabel('Topic 2 name')).toHaveValue('Glycolysis and fermentation') // earlier edits kept
  await topics.getByRole('button', { name: 'Save topics' }).click()
  await expect(topics.getByRole('listitem', { name: 'Pyruvate' })).toBeVisible()
  await expect(topics.getByRole('button', { name: 'Update topics' })).toHaveCount(0)
})

test('a course with too little material is told so, and nothing is drafted', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  await inBiology(page)
  await page.goto('/progress')
  const topics = page.getByRole('region', { name: 'Topics' })
  await topics.getByRole('button', { name: 'Draft topics' }).click()
  await expect(topics.getByRole('alert')).toContainText('Add a few more notes')
  await expect(topics.getByRole('button', { name: 'Save topics' })).toHaveCount(0)
})
