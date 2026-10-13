import Image from '@tiptap/extension-image'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

// A picture on a line of its own; its address is a studyhub-image: token (or a web address), which the node view works out when drawing
export const NoteImage = Image.configure({ allowBase64: false })

// Puts a picture in at the cursor. With a picture already selected (the one just added) it goes after it instead of replacing it.
export function insertNoteImage(editor: Editor, src: string, alt: string) {
  const { selection } = editor.state
  if (selection instanceof NodeSelection) return editor.chain().focus().insertContentAt(selection.to, { type: 'image', attrs: { src, alt } }).run()
  return editor.chain().focus().setImage({ src, alt }).run()
}

// Every picture in the note, in order, with where it sits
export function noteImages(editor: Editor): { pos: number; src: string; alt: string }[] {
  const out: { pos: number; src: string; alt: string }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image') out.push({ pos, src: String(node.attrs.src ?? ''), alt: String(node.attrs.alt ?? '') })
  })
  return out
}
