import { expect, type Page } from '@playwright/test'

export async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ama')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password').fill('local-e2e-pass-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('Your first course').fill('Biology')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/home/)
  await page.waitForLoadState('networkidle') // let Home hydrate before a test types into it
  return email
}
