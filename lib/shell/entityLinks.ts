// The things in the app that have a page of their own, found from an address, so a right click on a link to one can offer what can be done with it.

export type EntityKind = 'note' | 'deck' | 'lecture' | 'course' | 'notebook' | 'chat' | 'quiz' | 'file'
export type Entity = { kind: EntityKind; id: string }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ROUTES: [EntityKind, RegExp][] = [
  ['note', new RegExp(`^/notes/(${UUID})$`, 'i')],
  ['deck', new RegExp(`^/flashcards/(${UUID})$`, 'i')],
  ['lecture', new RegExp(`^/lectures/(${UUID})$`, 'i')],
  ['course', new RegExp(`^/courses/(${UUID})$`, 'i')],
  ['notebook', new RegExp(`^/notebooks/(${UUID})$`, 'i')],
  ['chat', new RegExp(`^/tutor/(${UUID})$`, 'i')],
  ['quiz', new RegExp(`^/quiz/(${UUID})$`, 'i')],
  ['file', new RegExp(`^/files/(${UUID})$`, 'i')],
]

/** The thing an app path is the page of ("/notes/<id>"), or null for any other path. A query or hash is ignored. */
export function parseEntity(path: string): Entity | null {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, '')
  for (const [kind, re] of ROUTES) {
    const m = re.exec(clean)
    if (m) return { kind, id: m[1] }
  }
  return null
}
