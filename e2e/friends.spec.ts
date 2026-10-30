import { test, expect } from '@playwright/test'
import { noteWithText, signUp } from './helpers'

// Two students in two browsers: they become friends by code, one shares a note, the other reads it and saves a copy
test('friends: add by code, accept, see the weekly board, share a note and save a copy', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const ama = page
  // the second student on the same kind of screen as the first (a phone in the mobile run)
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, baseURL } = test.info().project.use
  const kofi = await (await browser.newContext({ viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, baseURL })).newPage()
  await signUp(ama)
  await signUp(kofi)

  await ama.goto('/friends')
  const codeText = ama.getByRole('region', { name: 'Add a friend' }).locator('.font-mono.text-2xl')
  await expect(codeText).toHaveText(/^[A-Z2-9]{8}$/) // once it has loaded
  const code = (await codeText.textContent())!.trim()

  // Kofi follows Ama's invite link: the code is filled in
  await kofi.goto(`/friends?code=${code.toLowerCase()}`)
  await expect(kofi.getByLabel('A friend\'s code')).toHaveValue(code)
  await kofi.getByRole('button', { name: 'Add friend' }).click()
  await expect(kofi.getByRole('region', { name: 'Add a friend' }).getByRole('status')).toContainText('Request sent')
  await expect(kofi.getByText('Waiting for them to accept')).toBeVisible()

  // Ama accepts; both are on each other's board
  await ama.reload()
  await ama.getByRole('region', { name: 'Requests' }).getByRole('button', { name: 'Accept' }).click()
  await expect(ama.getByRole('list', { name: 'This week\'s XP' }).getByRole('listitem')).toHaveCount(2)
  await expect(ama.getByRole('region', { name: 'Your friends' }).getByRole('button', { name: 'Remove' })).toBeVisible()

  // Ama shares a note with Kofi
  await noteWithText(ama, 'Krebs cycle for Kofi')
  await ama.getByRole('button', { name: 'Share with friends' }).click()
  const dialog = ama.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: /^Share with / }).check()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(ama.getByText('Shared with 1 friend.')).toBeVisible()

  // Kofi reads it and saves a copy, which becomes his own note
  await kofi.goto('/friends')
  await kofi.getByRole('region', { name: 'Shared with you' }).getByRole('link', { name: /Krebs cycle for Kofi/ }).click()
  await expect(kofi.getByRole('heading', { level: 1, name: 'Krebs cycle for Kofi' })).toBeVisible()
  await expect(kofi.getByText(/mitochondrial matrix/).first()).toBeVisible()
  await kofi.getByRole('button', { name: 'Save a copy' }).click()
  await expect(kofi).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await expect(kofi.getByLabel('Title')).toHaveValue('Krebs cycle for Kofi')

  // Ama stops sharing: it leaves Kofi's list, and his copy stays
  await ama.goto('/friends')
  await ama.getByRole('region', { name: 'Shared by you' }).getByRole('button', { name: 'Stop sharing' }).click()
  await kofi.goto('/friends')
  await expect(kofi.getByText('When a friend shares a note or a deck with you, it shows here.')).toBeVisible()
  await kofi.goto('/notes')
  await expect(kofi.getByText('Krebs cycle for Kofi').first()).toBeVisible()
})
