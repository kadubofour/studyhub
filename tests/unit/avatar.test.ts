import { describe, it, expect } from 'vitest'
import { AVATAR_COLORS, AVATAR_NAMES, initials, isAvatarColor } from '@/lib/profile/avatar'
import { contrastRatio } from '@/lib/appearance'

describe('initials', () => {
  it('takes the first letters of the first and last name', () => {
    expect(initials('Ama Mensah', null)).toBe('AM')
    expect(initials('  kwadwo   boateng  asante ', null)).toBe('KA')
  })
  it('takes one letter from a single name', () => { expect(initials('Ama', null)).toBe('A') })
  it('falls back to the email when there is no name', () => {
    expect(initials(null, 'ama@example.com')).toBe('A')
    expect(initials('   ', 'ama@example.com')).toBe('A')
  })
  it('is a question mark when there is nothing to go on', () => { expect(initials(null, null)).toBe('?') })
  it('keeps accents and does not split an emoji', () => {
    expect(initials('Élodie Önal', null)).toBe('ÉÖ')
    expect(initials('🎓 Study', null)).toBe('🎓S')
  })
})

describe('avatar colours', () => {
  it('has eight, and white initials are readable on every one (WCAG AA)', () => {
    expect(AVATAR_COLORS).toHaveLength(8)
    for (const c of AVATAR_COLORS) expect(contrastRatio('#ffffff', c), c).toBeGreaterThanOrEqual(4.5)
  })
  it('gives each colour a name that can be read out', () => {
    expect(AVATAR_NAMES).toHaveLength(8)
    expect(AVATAR_NAMES.every(n => /^[A-Z][a-z]+$/.test(n))).toBe(true)
    expect(new Set(AVATAR_NAMES).size).toBe(8)
  })
  it('recognises only its own colours, whatever the letter case', () => {
    expect(isAvatarColor('#3B5BDB')).toBe(true)
    expect(isAvatarColor('#3b5bdb')).toBe(true)
    expect(isAvatarColor('#123456')).toBe(false)
    expect(isAvatarColor(null)).toBe(false)
  })
})
