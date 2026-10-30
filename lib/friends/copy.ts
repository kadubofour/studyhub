import type { SupabaseClient } from '@supabase/supabase-js'
import { createNote, updateNote } from '@/lib/data/notes'
import { createDeck } from '@/lib/data/decks'
import { createCards } from '@/lib/data/cards'
import { IMAGE_BUCKET, imageFilesIn, imagePath, toToken } from '@/lib/notes/images'
import { uploadNoteImage } from '@/lib/notes/prepareImage'
import type { SharedDeck, SharedNote } from '@/lib/data/friends'
import type { Note } from '@/lib/types'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A friend's note saved as your own: the words, the maths and the drawing, and each picture copied into your own folder,
// so the copy keeps working whatever happens to theirs. A picture that cannot be copied is left as its description.
export async function copySharedNote(sb: SupabaseClient, userId: string, note: SharedNote): Promise<string> {
  let md = note.content_md
  for (const file of imageFilesIn(md)) {
    const token = escape(toToken(file))
    try {
      const { data, error } = await sb.storage.from(IMAGE_BUCKET).download(imagePath(note.owner_id, file))
      if (error || !data) throw error ?? new Error('no picture')
      const mine = await uploadNoteImage(sb, userId, data.type ? data : new Blob([data], { type: 'image/png' }))
      md = md.replace(new RegExp(token, 'g'), mine)
    } catch {
      md = md.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${token}\\)`, 'g'), '$1')
    }
  }
  const made = await createNote(sb, { title: note.title, content_md: md })
  if (Array.isArray(note.ink) && note.ink.length) await updateNote(sb, made.id, { ink: note.ink as Note['ink'] })
  return made.id
}

// A friend's deck saved as your own: the same cards, new to you, so they are scheduled from today
export async function copySharedDeck(sb: SupabaseClient, deck: SharedDeck): Promise<string> {
  const made = await createDeck(sb, { name: deck.name })
  await createCards(sb, made.id, deck.cards)
  return made.id
}
