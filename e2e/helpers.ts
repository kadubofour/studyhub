import { expect, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const PASSWORD = 'local-e2e-pass-123'

export async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ama')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Confirm email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel('Your first course').fill('Biology')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/home/)
  await page.waitForLoadState('networkidle') // let Home hydrate before a test types into it
  return email
}

// A phone has no File, Edit and View menus on a note: their actions are in the Note options sheet
const onPhone = async (page: Page) => (page.viewportSize()?.width ?? 1280) < 768 // the menus show from md (768px) up
async function inSheet(page: Page) {
  await page.getByRole('button', { name: 'Note options' }).click()
  return page.getByRole('dialog', { name: 'Note options' })
}

export async function switchToMarkdown(page: Page) {
  if (await onPhone(page)) { await (await inSheet(page)).getByRole('radio', { name: 'Markdown' }).click(); await page.keyboard.press('Escape'); return }
  await page.getByRole('menuitem', { name: 'View' }).click()
  await page.getByRole('menuitemradio', { name: 'Markdown editor' }).click()
}

export async function readingMode(page: Page) {
  if (await onPhone(page)) { await (await inSheet(page)).getByRole('radio', { name: 'Read' }).click(); await page.keyboard.press('Escape'); return }
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Reading mode/ }).click()
}

export async function noteFileAction(page: Page, item: 'Export as Word' | 'Export as PDF') {
  if (await onPhone(page)) { await (await inSheet(page)).getByRole('button', { name: item }).click(); return }
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: item }).click()
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

// The + that makes things: in the rail on a computer, in the dock on a phone. Picks an item from its menu.
export async function create(page: Page, item: 'New note' | 'New deck' | 'Record lecture' | 'New task' | 'New reminder' | 'Upload' | 'Scan') {
  await page.locator('button[aria-label="Create new"]:visible').click()
  await page.getByRole('menu', { name: 'Create' }).getByRole('menuitem', { name: item }).click()
}

// A new note from inside a note: File > New note on a computer; a phone has no File menu, so from the Notes list
export async function newNoteFromNote(page: Page) {
  const file = page.getByRole('menuitem', { name: 'File', exact: true })
  if (await file.isVisible()) {
    await file.click()
    await page.getByRole('menu', { name: 'File' }).locator('[role^="menuitem"]', { hasText: 'New note' }).click()
  } else {
    await page.goto('/notes')
    await page.getByRole('button', { name: 'Note', exact: true }).click()
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
    await page.waitForLoadState('networkidle')
  }
}

// Chooses an option from one of the app's dropdowns, as a person does: open it by its label, then click the option
export async function choose(scope: Page | Locator, label: string, option: string) {
  await scope.getByRole('button', { name: label, exact: true }).click()
  const page = 'page' in scope ? scope.page() : scope
  await page.getByRole('listbox', { name: label }).getByRole('option', { name: option, exact: true }).click()
}

// Calls one of the database's functions as a student signed up with signUp (their email, the e2e password), straight
// against the local Supabase, for steps the app has no screen for yet (making a share link)
export async function rpcAs<T = unknown>(email: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  const url = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(env)![1].trim()
  const anon = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(env)![1].trim()
  const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(auth.ok).toBe(true)
  const { access_token } = await auth.json() as { access_token: string }
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  expect(res.ok, await res.clone().text()).toBe(true)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}
