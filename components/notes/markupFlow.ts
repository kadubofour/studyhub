import type { Editor } from '@tiptap/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadNoteImage } from '@/lib/notes/prepareImage'
import { insertNoteImage } from './noteImage'

/** What the markup tool was opened for: a picture already in the note, or a new sketch */
export type MarkupTarget = { kind: 'edit'; pos: number; src: string } | { kind: 'draw' }

// Finds the picture the tool was opened on: where it was, or failing that the first picture with the same address
function locate(editor: Editor, pos: number, src: string): number | null {
  const at = editor.state.doc.nodeAt(pos)
  if (at?.type.name === 'image' && at.attrs.src === src) return pos
  let found: number | null = null
  editor.state.doc.descendants((node, p) => {
    if (found === null && node.type.name === 'image' && node.attrs.src === src) found = p
  })
  return found
}

/**
 * Puts the finished picture in the note: a sketch is inserted, marked-up work replaces the picture it started from.
 * The picture it replaced is left in storage: undo, a copy of the picture in another note, or a save that has not gone through yet may still point at it.
 */
export async function applyMarkup(editor: Editor, sb: SupabaseClient, userId: string, target: MarkupTarget, picture: Blob): Promise<void> {
  const token = await uploadNoteImage(sb, userId, picture)
  if (target.kind === 'draw') { insertNoteImage(editor, token, 'Drawing'); return }
  const pos = locate(editor, target.pos, target.src)
  if (pos === null) { insertNoteImage(editor, token, 'Marked-up picture'); return }
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...editor.state.doc.nodeAt(pos)!.attrs, src: token }))
}
