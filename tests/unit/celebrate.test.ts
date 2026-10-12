import { describe, it, expect } from 'vitest'
import { celebrate } from '@/lib/xp/celebrate'

const at = (total: number, level: number) => ({ total, level })

describe('celebrate', () => {
  it('says nothing the first time XP is seen, so a page load is not a celebration', () => {
    expect(celebrate(null, at(120, 2))).toBeNull()
  })
  it('says nothing when XP has not changed or went down', () => {
    expect(celebrate(at(120, 2), at(120, 2))).toBeNull()
    expect(celebrate(at(120, 2), at(100, 2))).toBeNull() // something earning it was deleted
  })
  it('reports the points gained', () => {
    expect(celebrate(at(120, 2), at(145, 2))).toEqual({ gained: 25, levelUp: null })
  })
  it('reports a new level too', () => {
    expect(celebrate(at(190, 2), at(210, 3))).toEqual({ gained: 20, levelUp: 3 })
  })
  it('reports the level reached when several are climbed at once', () => {
    expect(celebrate(at(40, 1), at(460, 4))).toEqual({ gained: 420, levelUp: 4 })
  })
})
