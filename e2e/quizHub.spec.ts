import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp, noteWithText } from './helpers'

test('the Quiz page keeps every quiz and how it went: make one, take it, see the scores, retake and delete it', async ({ page }) => {
  test.setTimeout(150_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')

  // Nothing yet: an empty page that starts the first quiz
  await page.goto('/quiz')
  await expect(page.getByRole('heading', { name: 'Quiz', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No quizzes yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Make your first quiz' }).click()
  const dialog = page.getByRole('dialog', { name: 'Quiz yourself' })
  await dialog.getByRole('radio', { name: /Krebs cycle/ }).click()
  await dialog.getByRole('button', { name: /Start quiz/ }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)

  // Three of four right
  await page.getByRole('button', { name: 'Mitochondrial matrix' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'True', exact: true }).click() // wrong
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('nadh')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('acetyl coenzyme A')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('3 / 4')).toBeVisible()

  // The page now holds it: numbers, scores, a course-less group, and the quiz in the list
  await page.goto('/quiz')
  const numbers = page.getByRole('region', { name: 'Your quiz numbers' })
  await expect(numbers.getByText('Quizzes taken').locator('..')).toContainText('1')
  await expect(numbers.getByText('Average score').locator('..')).toContainText('75%')
  await expect(numbers.getByText('Questions right').locator('..')).toContainText('of 4 answered')
  await expect(page.getByRole('img', { name: 'Your last score: 75%' })).toBeVisible()
  const list = page.getByRole('region', { name: 'All quizzes' })
  await expect(list).toContainText('Taken 1× · best 75% · last 75%')
  await expect(page.getByRole('region', { name: 'Worth another go' })).toHaveCount(0) // 75% is fine

  // Search finds it, a search for something else does not
  await page.getByLabel('Search quizzes').fill('zzzz')
  await expect(page.getByText('No quizzes match.')).toBeVisible()
  await page.getByLabel('Search quizzes').fill('krebs')
  await expect(list.getByRole('link', { name: 'Retake' })).toBeVisible()

  // No accessibility problems
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  // Retake goes to the quiz; deleting it asks first, then the page is empty again
  await list.getByRole('link', { name: 'Retake' }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
  await page.goBack()
  await page.getByRole('button', { name: /^Delete / }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No quizzes yet' })).toBeVisible()
})

test('the sidebar has a Quiz page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar is for a computer')
  await signUp(page)
  await page.getByRole('navigation').first().getByRole('link', { name: 'Quiz', exact: true }).click()
  await expect(page).toHaveURL(/\/quiz$/)
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'Quiz', exact: true })).toHaveAttribute('aria-current', 'page')
})
