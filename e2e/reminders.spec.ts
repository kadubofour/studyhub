import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { create, signUp } from './helpers'

test('my reminders: made from the Create menu, listed with when and how often, kept after a reload, and deleted', async ({ page }) => {
  await signUp(page)
  await create(page, 'New reminder')
  await expect(page).toHaveURL(/\/reminders/)
  const dialog = page.getByRole('dialog', { name: 'New reminder' })
  await dialog.getByLabel('What').fill('Email my tutor')
  await dialog.getByRole('radio', { name: 'Every day' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  const upcoming = page.getByRole('list', { name: 'Upcoming' })
  await expect(upcoming).toContainText('Email my tutor')
  await expect(upcoming).toContainText('Every day')

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await page.reload()
  await expect(page.getByRole('list', { name: 'Upcoming' })).toContainText('Email my tutor') // it was saved
  await page.getByRole('button', { name: 'Delete Email my tutor' }).click()
  await expect(page.getByRole('heading', { name: 'No reminders yet' })).toBeVisible()
})
