// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

// An open note (app/(app)/notes/[id]/page.tsx and its editor)
const page = () => fs.readFileSync('app/(app)/notes/[id]/page.tsx', 'utf8')
const editor = () => fs.readFileSync('components/notes/RichEditor.tsx', 'utf8')
const css = () => fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')

describe('an open note', () => {
  it('the formatting toolbar sticks right under the top bar, however tall the top bar is', () => {
    expect(editor()).toContain('sticky top-[var(--note-head,57px)]')
    expect(page()).toContain("style.setProperty('--note-head'")
    expect(page()).toContain('new ResizeObserver(')
  })
  it('the toolbar fades at the edge while more tools are off-screen, so it is clear it scrolls', () => {
    expect(editor()).toMatch(/data-more=\{more \|\| undefined\}/)
    expect(css()).toMatch(/\[data-more\][^{]*\{[^}]*mask-image: linear-gradient\(to right, #000 80%, transparent\)/)
  })
  it('an empty note says where to start writing', () => {
    expect(editor()).toContain("Placeholder.configure({ placeholder: 'Start writing…' })")
    expect(css()).toMatch(/\.ProseMirror p\.is-editor-empty:first-child::before \{[^}]*content: attr\(data-placeholder\)/)
  })
  it('a new note\'s title "Untitled" is selected on focus, so typing replaces it', () => {
    expect(page()).toContain("onFocus={e => { setTitleFocused(true); if (e.target.value === 'Untitled') e.target.select() }}")
  })
})
