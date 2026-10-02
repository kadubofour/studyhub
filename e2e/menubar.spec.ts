import { test, expect, type Page } from '@playwright/test'
import { signUp } from './helpers'

async function newNote(page: Page, title: string) {
  await page.goto('/notes')
  await page.getByRole('button', { name: 'Write your first note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Title').fill(title)
}

async function menu(page: Page, name: string, item: string | RegExp) {
  await page.getByRole('menuitem', { name, exact: true }).click()
  await page.getByRole('menu', { name }).locator('[role^="menuitem"]', { hasText: item }).click()
}

test('the password field can be shown and hidden', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  const field = page.getByLabel('Password', { exact: true })
  await field.fill('secret-pass')
  await expect(field).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(field).toHaveAttribute('type', 'password')
})

test('Edit > Insert table: pick the size on a grid, and it is saved with the note', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Table note')
  await page.getByLabel('Note', { exact: true }).click()
  await menu(page, 'Edit', 'Insert table')
  await page.getByRole('button', { name: '2 by 4 table' }).hover()
  await expect(page.getByText('2 × 4 table')).toBeVisible()
  await page.getByRole('button', { name: '2 by 4 table' }).click()
  const table = page.locator('.ProseMirror table')
  await expect(table.locator('tr')).toHaveCount(2)
  await expect(table.locator('th')).toHaveCount(4)
  await page.keyboard.type('Organelle')
  await page.getByRole('toolbar', { name: 'Table' }).getByRole('button', { name: 'Add row below' }).click()
  await expect(table.locator('tr')).toHaveCount(3)
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ProseMirror table th').first()).toHaveText('Organelle')
})

test('the toolbar Table button opens the same size grid', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Grid')
  await page.getByLabel('Note', { exact: true }).click()
  await page.getByRole('button', { name: 'Table', exact: true }).click()
  await page.getByRole('dialog', { name: 'Insert table' }).getByRole('button', { name: '3 by 2 table' }).click()
  await expect(page.locator('.ProseMirror table tr')).toHaveCount(3)
  await expect(page.locator('.ProseMirror table th')).toHaveCount(2)
})

test('maths typed without dollars turns into an equation', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Auto maths')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('Then x^2 grows and my_variable stays ')
  await expect(page.locator('.ProseMirror [data-type="inline-math"] .katex')).toHaveCount(1)
  await expect(page.locator('.ProseMirror')).toContainText('my_variable')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Markdown editor' }).click()
  const md = page.getByLabel('Markdown')
  await expect(md).toHaveValue(/Then \$x\^2\$ grows/)
  await md.press('End')
  await md.pressSequentially(' and a_n ')
  await expect(md).toHaveValue(/and \$a_n\$ $/)
})

test('typed $…$ becomes an equation, and clicking it opens it for editing', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Maths')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('Area is $\\pi r^2$ ')
  const math = page.locator('.ProseMirror [data-type="inline-math"]')
  await expect(math.locator('.katex')).toBeVisible()
  // A real mouse click: ProseMirror redraws the node on mousedown, which trips locator.click's hit check
  const box0 = (await math.boundingBox())!
  await page.mouse.click(box0.x + box0.width / 2, box0.y + box0.height / 2)
  const box = page.getByLabel('LaTeX')
  await expect(box).toHaveValue('\\pi r^2')
  await box.fill('2\\pi r')
  await page.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.reload()
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Markdown editor' }).click()
  await expect(page.getByLabel('Markdown')).toHaveValue(/\$2\\pi r\$/)
})

test('Edit > Insert equation, reading mode and find', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Cells')
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('The cell membrane surrounds the cell. ')
  await menu(page, 'Edit', 'Insert equation')
  await page.getByLabel('LaTeX').fill('E = mc^2')
  await expect(page.getByRole('dialog').locator('.katex')).toBeVisible() // live preview
  await page.getByRole('button', { name: 'Insert' }).click()
  await expect(page.locator('.ProseMirror .katex')).toBeVisible()

  await page.keyboard.press('Control+f')
  await page.getByRole('searchbox', { name: 'Find in note' }).fill('cell')
  await expect(page.getByText('1 of 2')).toBeVisible()
  await expect(page.locator('.ProseMirror .find-hit')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Find in note' }).press('Escape')
  await expect(page.locator('.ProseMirror .find-hit')).toHaveCount(0)
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/) // Esc closed find, not the note

  await menu(page, 'View', 'Reading mode')
  await expect(page.getByRole('heading', { name: 'Cells', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveCount(0)
  await expect(page.locator('article .katex').first()).toBeVisible()
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Insert table' })).toHaveAttribute('aria-disabled', 'true')
})

test('File > New note and Delete note', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'First')
  await expect(page.getByText('Saved')).toBeVisible()
  const first = page.url()
  await menu(page, 'File', 'New note')
  await expect(page).not.toHaveURL(first)
  await expect(page.getByLabel('Title')).toHaveValue('Untitled')
  // No browser pop-up: some browsers block confirm(), which used to make Delete do nothing
  page.on('dialog', d => { throw new Error(`unexpected native ${d.type()} dialog`) })
  await menu(page, 'File', 'Delete note')
  const ask = page.getByRole('dialog', { name: 'Delete this note?' })
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/) // kept
  await menu(page, 'File', 'Delete note')
  await ask.getByRole('button', { name: 'Delete note' }).click()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByRole('link', { name: /First/ })).toBeVisible() // the other note is untouched
  await expect(page.getByRole('link', { name: /Untitled/ })).toHaveCount(0)
})

test('right-click in a note opens quick actions', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Quick')
  const ed = page.getByLabel('Note', { exact: true })
  await ed.click()
  await page.keyboard.type('Rate is x^2 today ')
  await ed.click({ button: 'right', position: { x: 300, y: 60 } })
  const quick = page.getByRole('menu', { name: 'Quick actions' })
  await expect(quick).toBeVisible()
  await quick.getByRole('menuitem', { name: /Insert table/ }).click()
  await quick.getByRole('button', { name: '2 by 2 table' }).click()
  const table = page.locator('.ProseMirror table')
  await expect(table.locator('th')).toHaveCount(2)

  // In a table the menu offers row/column actions
  await table.locator('td').first().click({ button: 'right' })
  await expect(quick.getByRole('menuitem', { name: 'Delete table' })).toBeVisible()
  await quick.getByRole('menuitem', { name: 'Add column right' }).click()
  await expect(table.locator('th')).toHaveCount(3)

  // On an equation: Edit equation
  const math = page.locator('.ProseMirror [data-type="inline-math"]')
  const b = (await math.boundingBox())!
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: 'right' })
  await quick.getByRole('menuitem', { name: 'Edit equation' }).click()
  await expect(page.getByLabel('LaTeX')).toHaveValue('x^2')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.keyboard.press('Escape') // Esc with no menu open leaves the note
  await expect(page).toHaveURL(/\/notes$/)
})

test('automatic maths can be switched off from the View menu', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Code notes')
  await menu(page, 'View', 'Automatic maths')
  await expect(page.getByText(/Automatic maths is off/)).toBeVisible()
  await page.getByLabel('Note', { exact: true }).click()
  await page.keyboard.type('my x^2 stays ')
  await expect(page.locator('.ProseMirror .katex')).toHaveCount(0)
  // and it is remembered: Settings shows it off
  await page.goto('/settings')
  await expect(page.getByRole('switch', { name: /Turn typed maths into equations/ })).toHaveAttribute('aria-checked', 'false')
})

test('notes list: right-click a note to delete it', async ({ page }) => {
  await signUp(page)
  await newNote(page, 'Throwaway')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.goto('/notes')
  await page.getByRole('link', { name: /Throwaway/ }).click({ button: 'right' })
  await page.getByRole('menu', { name: 'Throwaway' }).getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete note' }).click()
  await expect(page.getByRole('link', { name: /Throwaway/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Write your first note' })).toBeVisible()
})
