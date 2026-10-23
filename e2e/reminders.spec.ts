import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { create, signUp } from './helpers'

test('my reminders: made over the page from the Create menu, shown in the Planner, kept after a reload, and deleted', async ({ page }) => {
  await signUp(page)
  await create(page, 'New reminder')
  await expect(page).toHaveURL(/\/home/) // it opens where the student is
  const dialog = page.getByRole('dialog', { name: 'New reminder' })
  await dialog.getByLabel('What').fill('Email my tutor')
  await dialog.getByRole('radio', { name: 'Every day' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/Reminder set for/)).toBeVisible()

  await page.goto('/planner?list=reminders')
  const upcoming = page.getByRole('list', { name: 'Upcoming' })
  await expect(upcoming).toContainText('Email my tutor')
  await expect(upcoming).toContainText('Every day')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await page.reload()
  await expect(page.getByRole('list', { name: 'Upcoming' })).toContainText('Email my tutor') // it was saved
  await page.getByRole('button', { name: 'Delete Email my tutor' }).click()
  await expect(page.getByText(/No reminders yet/)).toBeVisible()
})

test('Remind me on a task makes a reminder about it, listed with a way back to the Planner', async ({ page }) => {
  await signUp(page)
  await page.goto('/planner')
  await page.getByPlaceholder(/Add a task/).fill('Essay draft')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Remind me about Essay draft' }).click()
  const dialog = page.getByRole('dialog', { name: 'New reminder' })
  await expect(dialog.getByLabel('What')).toHaveValue('Essay draft')
  await expect(dialog.getByText('About Essay draft')).toBeVisible()
  await dialog.getByLabel('Date').fill('2099-01-01')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: /^Reminders/ }).click()
  await expect(page.getByRole('list', { name: 'Upcoming' }).getByRole('link', { name: 'Essay draft' })).toHaveAttribute('href', '/planner')
})
