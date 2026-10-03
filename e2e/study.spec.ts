import { test, expect } from '@playwright/test'
import { signUp, noteWithText } from './helpers'

const openStudy = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: '✦ Study' }).click()
  return page.getByRole('complementary', { name: 'Study' })
}

test('summary: add at the top of the note, then remove it', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  const study = await openStudy(page)
  await study.getByRole('button', { name: '✦ Summarise' }).click()
  await expect(page.locator('.ProseMirror blockquote').first()).toContainText('Summary')
  await expect(page.locator('.ProseMirror blockquote').first()).toContainText('NADH')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror blockquote').first()).toContainText('NADH') // it was saved
  const again = await openStudy(page)
  await again.getByRole('button', { name: 'Remove summary' }).click()
  await expect(page.locator('.ProseMirror blockquote')).toHaveCount(0)
})

test('flashcards: review, untick one, save to a new deck', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  const study = await openStudy(page)
  await study.getByRole('tab', { name: 'Cards' }).click()
  await study.getByRole('button', { name: '✦ Make flashcards' }).click()
  await study.getByRole('checkbox', { name: 'Keep card 2' }).uncheck()
  await study.getByRole('button', { name: 'Save 1 card' }).click()
  await expect(page.getByText('Saved 1 card.')).toBeVisible()
  await page.goto('/flashcards')
  await expect(page.getByText('Krebs cycle')).toBeVisible()
})

test('quiz: take it, get marked, results, wrong answers to cards, score on Progress', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  const study = await openStudy(page)
  await study.getByRole('tab', { name: 'Quiz' }).click()
  await study.getByRole('button', { name: '✦ New quiz' }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: 'Mitochondrial matrix' }).click()
  await expect(page.getByText('Correct.')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'True' }).click()            // wrong
  await expect(page.getByText(/Not quite/)).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('nadh')                    // exact match, no AI
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('acetyl coenzyme A')       // AI-marked (fake says correct)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByText('Yes, that means acetyl-CoA.')).toBeVisible()
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('3 / 4')).toBeVisible()
  await page.getByRole('button', { name: 'Make cards from 1 wrong answer' }).click()
  await page.getByRole('button', { name: 'Save 1 card' }).click()
  await expect(page.getByText('Saved 1 card.')).toBeVisible()
  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: 'Quiz scores' })).toBeVisible()
})

test('refreshing mid-quiz resumes where you left off', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  const study = await openStudy(page)
  await study.getByRole('tab', { name: 'Quiz' }).click()
  await study.getByRole('button', { name: '✦ New quiz' }).click()
  await page.getByRole('button', { name: 'Mitochondrial matrix' }).click()
  await expect(page.getByText('Correct.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Question 2 of 4')).toBeVisible()
})

test('going too fast gets a "try again in a minute" message, not a cap', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  expect((await page.request.post('/api/test-openai/flood')).ok()).toBe(true)
  const study = await openStudy(page)
  await study.getByRole('button', { name: '✦ Summarise' }).click()
  await expect(study.getByRole('alert')).toHaveText('You\'re going a bit fast. Try again in a minute.')
})
