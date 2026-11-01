import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The maths is drawn by the katex that rehype-katex loads and styled by the katex stylesheet the app imports. When the two
// were different versions (0.16 drew, 0.18 styled) equation numbers sat beside the equation, \u2260 lost its slash and subscripts
// dropped out of place, so there must be one copy of katex in the whole install.
const modules = path.join(__dirname, '..', '..', 'node_modules')
function copies(dir: string, found: string[] = []): string[] {
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const full = path.join(dir, name)
    if (name === 'katex' && fs.existsSync(path.join(full, 'package.json'))) found.push(full)
    const inner = path.join(full, 'node_modules')
    if (fs.existsSync(inner)) copies(inner, found)
    if (name.startsWith('@')) for (const sub of fs.readdirSync(full)) { const scoped = path.join(full, sub, 'node_modules'); if (fs.existsSync(scoped)) copies(scoped, found) }
  }
  return found
}

describe('katex', () => {
  it('is installed once, so what draws the maths and what styles it are the same version', () => {
    expect(copies(modules).map(p => path.relative(modules, p))).toEqual(['katex'])
  })
})
