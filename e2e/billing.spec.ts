import { test, expect } from '@playwright/test'
import { signUp, noteWithText } from './helpers'

test('free limit → Get Premium → pay with MoMo → Premium', async ({ page }) => {
  await signUp(page)
  await noteWithText(page)
  await page.getByRole('button', { name: '✦ Study' }).click()
  const study = page.getByRole('complementary', { name: 'Study' })
  await expect(study.getByText('10 of 10 free AI actions left today')).toBeVisible()
  expect((await page.request.post('/api/test-openai/burn-free?count=10')).ok()).toBe(true) // use up today's free actions
  await study.getByRole('button', { name: '✦ Summarise' }).click()
  await expect(study.getByText('You\'ve used today\'s 10 free AI actions')).toBeVisible()
  await study.getByRole('link', { name: '✦ Get Premium · GHS 50/month' }).click()
  await expect(page).toHaveURL(/\/plans$/)
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Pay', exact: true }).click()
  await expect(page.getByText(/You're on Premium until/)).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByRole('main').getByText('✦ Premium', { exact: true })).toBeVisible()
  await expect(page.getByText(/GHS 50 · MoMo ✓/)).toBeVisible()
})

test('a pending MoMo payment is confirmed later', async ({ page }) => {
  await signUp(page)
  await page.goto('/plans')
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.waitForURL(/\/api\/test-paystack\/pay\?reference=/)
  const reference = new URL(page.url()).searchParams.get('reference')!
  await page.getByRole('link', { name: 'Approve later on phone' }).click()
  await expect(page.getByText('Confirming your payment…')).toBeVisible()
  await page.request.post(`/api/test-paystack/confirm-later?reference=${reference}`)
  await expect(page.getByText(/You're on Premium until/)).toBeVisible({ timeout: 15_000 })
})

test('a declined payment says so and charges nothing', async ({ page }) => {
  await signUp(page)
  await page.goto('/plans')
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Decline' }).click()
  await expect(page.getByText('Payment didn\'t go through. You haven\'t been charged.')).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText('Free', { exact: true })).toBeVisible()
})

test('auto-renew by card, then turn renewal off', async ({ page }) => {
  await signUp(page)
  await page.goto('/plans')
  await page.getByRole('checkbox', { name: 'Renew automatically (card only)' }).check()
  await page.getByRole('button', { name: 'Pay GHS 50 with Paystack' }).click()
  await page.getByRole('link', { name: 'Pay', exact: true }).click()
  await expect(page.getByText(/You're on Premium until/)).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText(/Renews automatically \(Visa •• 4081\)/)).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Turn off renewal' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn off' }).click()
  await expect(page.getByText(/Ends on/)).toBeVisible()
})
