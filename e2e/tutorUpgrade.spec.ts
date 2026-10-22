import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { noteWithText, signUp } from './helpers'

test('the Tutor page: ways to start, a starter that asks what it is about, and a chat that opens with its message ready', async ({ page }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.goto('/tutor')
  const ways = page.getByRole('region', { name: 'Ways to start' })
  await expect(ways.getByRole('button')).toHaveCount(4)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])

  await ways.getByRole('button', { name: /Quiz me/ }).click()
  const picker = page.getByRole('dialog', { name: 'Quiz me' })
  await picker.getByRole('button', { name: /Krebs cycle/ }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  // the message is ready, and nothing was sent
  await expect(page.getByLabel('Message')).toHaveValue('Quiz me on Krebs cycle')
  await expect(page.getByText(/Ask anything/)).toBeVisible()
  await expect(page.getByText('About').first()).toBeVisible()
})

test('in a chat: follow-ups, copy, regenerate, rename in place, and changing what it is about', async ({ page }) => {
  test.setTimeout(150_000)
  await signUp(page)
  await noteWithText(page, 'Glycolysis')
  // a second note, from the New note button (the first-note helper only works with none)
  await page.goto('/library')
  await page.getByRole('button', { name: 'New note' }).first().click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Title').fill('Krebs cycle')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The Krebs cycle happens in the mitochondrial matrix. '.repeat(6))
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('button', { name: 'Ask the tutor' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  await page.getByLabel('Message').fill('Where does it happen?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('mitochondrial matrix')).toBeVisible()

  // the follow-ups and the buttons on the reply
  const followUps = page.getByRole('group', { name: 'Follow-up questions' })
  await expect(followUps.getByRole('button')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Copy reply' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Regenerate reply' })).toBeVisible()
  await expect(page.getByText('19 of 20 tutor messages left today')).toBeVisible() // one used, on the free plan
  await followUps.getByRole('button', { name: 'Explain it simpler' }).click()
  await expect(page.getByText('Explain that again, in simpler words.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible() // the reply has finished

  // rename in place (no browser prompt)
  await page.getByRole('button', { name: 'Rename' }).click()
  const box = page.getByLabel('Chat name')
  await box.fill('Krebs revision')
  await box.press('Enter')
  await expect(page.getByRole('heading', { name: 'Krebs revision' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Krebs revision' })).toBeVisible()

  // what it is about can be changed, and removed
  await page.getByRole('button', { name: 'Change' }).click()
  const picker = page.getByRole('dialog', { name: 'What is this chat about?' })
  await picker.getByRole('button', { name: /Glycolysis/ }).click()
  await expect(page.getByRole('link', { name: 'Glycolysis' }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Glycolysis' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Not about a note or lecture')).toBeVisible()
})

test('in a chat: ideas to start with, times, copying, and a message box that grows', async ({ page, isMobile }) => {
  test.setTimeout(120_000)
  await signUp(page)
  await page.goto('/tutor')
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  const message = page.getByLabel('Message')
  await page.getByRole('group', { name: 'Ideas to start with' }).getByRole('button', { name: 'Quiz me' }).click()
  await expect(message).toHaveValue('Quiz me on ')
  const one = (await message.boundingBox())!.height
  await message.fill('line one\nline two\nline three\nline four\nline five')
  expect((await message.boundingBox())!.height).toBeGreaterThan(one)
  if (!isMobile) {
    await message.fill('Where does the Krebs cycle happen?')
    await message.press('Enter')
    await expect(page.getByText('Where does the Krebs cycle happen?')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Today' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy question' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy chat' })).toBeVisible()
  }
})

test('the Tutor page lists chats with what they are about', async ({ page }) => {
  await signUp(page)
  await noteWithText(page, 'Krebs cycle')
  await page.getByRole('button', { name: 'Ask the tutor' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  await page.goto('/tutor')
  const link = page.getByRole('link', { name: /Krebs cycle/ })
  await expect(link).toContainText('Note: Krebs cycle')
})

test('on a phone the message box is above the bottom bar', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone')
  await signUp(page)
  await page.goto('/tutor')
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/tutor\/[0-9a-f-]{36}$/)
  const form = await page.getByLabel('Message').locator('xpath=ancestor::form').boundingBox()
  const bar = await page.locator('nav[aria-label], nav').filter({ hasText: 'Home' }).last().boundingBox()
  expect(bar).not.toBeNull()
  expect(form!.y + form!.height).toBeLessThanOrEqual(bar!.y + 1)
})
