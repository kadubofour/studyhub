import { test, expect } from '@playwright/test'
import { signUp } from './helpers'

test('reminders live in Settings, turn on, and the focus alerts moved there', async ({ page }) => {
  await signUp(page)
  await page.goto('/settings?section=reminders')
  await expect(page.getByRole('heading', { name: 'Reminders', level: 2 })).toBeVisible()
  // Off until the student turns them on; the focus alerts are here, not on the Focus page
  await expect(page.getByRole('switch', { name: 'Remind me' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('region', { name: 'When time is up' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'What to remind me about' })).toHaveCount(0)

  await page.getByRole('switch', { name: 'Remind me' }).click()
  await expect(page.getByRole('switch', { name: 'Remind me' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('region', { name: 'What to remind me about' })).toBeVisible()
  await page.getByRole('switch', { name: 'Tasks due' }).click() // off
  await page.getByRole('switch', { name: 'Flashcards to review' }).click() // off
  await page.getByLabel('Classes starting: when').selectOption('30')

  await page.getByRole('button', { name: 'Send a test reminder' }).click()
  await expect(page.getByText('Reminders are on: This is what a reminder looks like.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('switch', { name: 'Remind me' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('switch', { name: 'Tasks due' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByLabel('Classes starting: when')).toHaveValue('30')

  await page.goto('/focus')
  await expect(page.getByRole('region', { name: 'When time is up' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings', exact: true }).last().click()
  await expect(page).toHaveURL(/section=reminders/)
})
