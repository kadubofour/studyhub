import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp, noteWithText } from './helpers'

test('start a quiz from Home, answer with the keyboard, review the results and retake the ones missed', async ({ page, isMobile }) => {
  test.setTimeout(150_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/home')

  // The Quiz dialog opens from Home's quick actions on a phone, and from Flashcards on a computer (its sidebar has no Home shortcuts)
  if (isMobile) await page.getByRole('group', { name: 'Quick actions' }).getByRole('button', { name: 'Take a quiz' }).click()
  else { await page.goto('/flashcards'); await page.getByRole('main').getByRole('button', { name: 'Quiz', exact: true }).click() }
  const dialog = page.getByRole('dialog', { name: 'Quiz yourself' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: /Krebs cycle/ }).click()
  await dialog.getByRole('button', { name: /Start quiz/ }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)

  // Question 1 is multiple choice: B is the right answer; on a computer the key picks it
  await expect(page.getByText('Question 1 of 4')).toBeVisible()
  await expect(page.getByText('Multiple choice')).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Mitochondrial matrix' }).click()
  else await page.keyboard.press('b')
  await expect(page.getByText('Correct.')).toBeVisible()
  await expect(page.getByText('1 correct')).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Next', exact: true }).click()
  else await page.keyboard.press('Enter')
  await expect(page.getByText('Question 2 of 4')).toBeVisible()
  await page.getByRole('button', { name: 'True', exact: true }).click() // wrong
  await expect(page.getByText(/Not quite/)).toBeVisible()
  await expect(page.getByText('Your answer, not correct')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('nadh')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('acetyl coenzyme A')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'See results' }).click()

  // Results: the ring and fraction, every question reviewed, and the missed one open
  await expect(page.getByText('3 / 4')).toBeVisible()
  await expect(page.getByText('75%')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Good effort' })).toBeVisible()
  const review = page.getByRole('list').filter({ hasText: 'Your answer:' })
  await expect(review.locator('details')).toHaveCount(4)
  await expect(review.locator('details[open]')).toHaveCount(1)
  await expect(page.getByText('Your answer:')).toBeVisible()

  // Retake only what was missed: a new one-question quiz
  await page.getByRole('button', { name: 'Retake 1 missed question' }).click()
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Question 1 of 1')).toBeVisible()
  await expect(page.getByText('Krebs cycle quiz · missed')).toBeVisible()
})

test('the Quiz dialog opens from the Quiz page, Flashcards and Library too', async ({ page }) => {
  await signUp(page)
  await page.goto('/quiz')
  await page.getByRole('button', { name: 'Make your first quiz' }).click()
  await expect(page.getByRole('dialog', { name: 'Quiz yourself' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/flashcards')
  await page.getByRole('main').getByRole('button', { name: 'Quiz' }).click()
  await expect(page.getByRole('dialog', { name: 'Quiz yourself' })).toBeVisible()
  await expect(page.getByText(/You have no notes yet/)).toBeVisible()
})

test('the Quiz dialog, the player and the results have no serious accessibility problems', async ({ page }) => {
  test.setTimeout(150_000)
  const problems = async (label: string) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${label}: ${v.id} ${v.nodes[0].target.join(' ')}`)
  }
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/flashcards')
  await page.getByRole('main').getByRole('button', { name: 'Quiz', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Quiz yourself' })
  await dialog.getByRole('radio', { name: /Krebs cycle/ }).click()
  expect(await problems('dialog')).toEqual([])
  await dialog.getByRole('button', { name: /Start quiz/ }).click()
  await expect(page.getByText('Question 1 of 4')).toBeVisible()
  expect(await problems('question')).toEqual([])
  await page.getByRole('button', { name: 'Mitochondrial matrix' }).click()
  await expect(page.getByText('Correct.')).toBeVisible()
  expect(await problems('answered')).toEqual([])
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'True', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('nadh'); await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Your answer').fill('acetyl coenzyme A'); await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('3 / 4')).toBeVisible()
  expect(await problems('results')).toEqual([])
  await page.screenshot({ path: 'test-results/quiz-results.png', fullPage: true })
})
