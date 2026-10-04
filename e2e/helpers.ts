import { expect, type Page } from '@playwright/test'

export async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ama')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('Your first course').fill('Biology')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/home/)
  await page.waitForLoadState('networkidle') // let Home hydrate before a test types into it
  return email
}

export async function switchToMarkdown(page: Page) {
  await page.getByRole('menuitem', { name: 'View' }).click()
  await page.getByRole('menuitemradio', { name: 'Markdown editor' }).click()
}

// A note with enough text for the AI study tools (they need at least 40 words)
export async function noteWithText(page: Page, title = 'Krebs cycle') {
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle happens in the mitochondrial matrix. '.repeat(6))
  await expect(page.getByText('Saved')).toBeVisible()
}

// Pays for a month of Premium through the fake Paystack (E2E only)
export async function becomePremium(page: Page) {
  await page.goto('/plans')
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Pay', exact: true }).click()
  await expect(page.getByText(/You're on Premium until/)).toBeVisible()
}
