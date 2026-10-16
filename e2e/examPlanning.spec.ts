import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUp } from './helpers'

async function openAdd(page: import('@playwright/test').Page, what: 'Add task' | 'Add exam') {
  const fab = page.getByRole('button', { name: 'Add to calendar' }) // on a phone the Add buttons are behind a round button
  if (await fab.isVisible()) { await fab.click(); await page.getByRole('menuitem', { name: what }).click() } else await page.getByRole('button', { name: what, exact: true }).click()
}

test('Add task and Add exam are different dialogs, and an exam is planned with a time, a length, a place and what it covers', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/planner')
  await page.getByRole('tab', { name: 'Week' }).click()

  // The task dialog is a task's: no exam in it
  await openAdd(page, 'Add task')
  await expect(page.getByRole('heading', { name: 'Add task' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Exam' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Add task' }).getByLabel('Starts at')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // The exam dialog is an exam's
  await openAdd(page, 'Add exam')
  await expect(page.getByRole('heading', { name: 'Add exam' })).toBeVisible()
  const dialog = page.getByRole('dialog', { name: 'Add exam' })
  await expect(dialog.getByLabel('Due date')).toHaveCount(0)
  await dialog.getByRole('radiogroup', { name: 'Course' }).getByRole('radio', { name: 'Biology' }).click()
  await expect(dialog.getByLabel('Title')).toHaveValue('Biology exam') // from the course; the rest of what an exam is sits behind More details
  await expect(dialog.getByLabel('What it covers')).toBeHidden()
  await dialog.getByText('More details').click()
  await dialog.getByRole('radio', { name: 'Midterm' }).click()
  await expect(dialog.getByLabel('Title')).toHaveValue('Biology midterm')
  const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'))
  await dialog.getByLabel('Day').fill(today)
  await dialog.getByLabel('Starts at').fill('14:00')
  await dialog.getByLabel('Hours').fill('2')
  await dialog.getByLabel('Minutes').fill('15') // any length: typed, not picked from a list
  await dialog.getByLabel('Where').fill('Hall B')
  await dialog.getByLabel('What it covers').fill('Chapters 1 to 5')
  await dialog.getByLabel('Counts for (% of the grade)').fill('30')
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Exam added.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Plan revision' })).toBeVisible()
  await page.getByRole('button', { name: 'Plan revision' }).click() // takes the student to where the revision plan is made
  await expect(page.getByRole('tab', { name: 'Tasks' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Week' }).click()

  // On the calendar it is a block from 14:00 to 16:15 with the room
  const block = page.locator('[data-exam="true"]', { hasText: 'Biology midterm' })
  await expect(block).toContainText('14:00–16:15')
  await expect(block).toContainText('Hall B')

  // Reopened, it is as it was saved, and a change shows
  await block.click()
  const edit = page.getByRole('dialog', { name: 'Edit exam' })
  await expect(edit).toBeVisible()
  await expect(edit.getByLabel('Starts at')).toHaveValue('14:00')
  await expect(edit.getByLabel('Where')).toHaveValue('Hall B')
  await expect(edit.getByLabel('Hours')).toHaveValue('2')
  await expect(edit.getByLabel('Minutes')).toHaveValue('15')
  await edit.getByLabel('Where').fill('Gym')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-exam="true"]', { hasText: 'Biology midterm' })).toContainText('Gym')

  // In the Tasks list it says when, where, how far, what it covers and counts for
  await page.getByRole('tab', { name: 'Tasks' }).click()
  const row = page.getByRole('region', { name: /Today|Overdue/ }).filter({ hasText: 'Biology midterm' })
  await expect(row).toContainText('14:00 to 16:15 · Gym')
  await expect(row).toContainText('today')
  await expect(row).toContainText('Covers: Chapters 1 to 5')
  await expect(row).toContainText('30% of the grade')

  // Moving it to tomorrow keeps the time it starts at
  await row.getByRole('button', { name: 'Move Biology midterm' }).click()
  await page.getByRole('menuitem', { name: 'Tomorrow' }).click()
  const moved = page.getByRole('region', { name: 'Tomorrow' }).filter({ hasText: 'Biology midterm' })
  await expect(moved).toContainText('14:00 to 16:15 · Gym')
  await expect(moved).toContainText('tomorrow')
})
