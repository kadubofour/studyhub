import type { SupabaseClient } from '@supabase/supabase-js'
import type { Proposal } from '@/lib/ai/tutorTools'
import { createNote } from '@/lib/data/notes'
import { createDeck } from '@/lib/data/decks'
import { createCards } from '@/lib/data/cards'
import { createTask } from '@/lib/data/tasks'
import { must } from '@/lib/data/util'

// "Add": saves what the tutor proposed, as the student, through the same functions they use by hand
// (so row-level security applies). Throws if any step fails; the proposal then stays pending.
export async function applyProposal(
  sb: SupabaseClient, p: Proposal, chat: { course_id: string | null; note_id: string | null },
): Promise<{ itemId: string; itemKind: 'note' | 'deck' | 'quiz' | 'task' }> {
  switch (p.tool) {
    case 'create_note': {
      const n = await createNote(sb, { title: p.args.title, content_md: p.args.body, course_id: p.args.course_id ?? chat.course_id })
      return { itemId: n.id, itemKind: 'note' }
    }
    case 'create_flashcards': {
      const deckId = p.args.deck_id ?? (await createDeck(sb, { name: p.args.deck_name!, course_id: p.args.course_id ?? chat.course_id })).id
      await createCards(sb, deckId, p.args.cards)
      return { itemId: deckId, itemKind: 'deck' }
    }
    case 'create_quiz': {
      if (!chat.note_id) throw new Error('no_note')
      const q = must(await sb.from('quizzes').insert({ note_id: chat.note_id, title: p.args.title, questions: p.args.questions }).select('id').single()) as { id: string }
      return { itemId: q.id, itemKind: 'quiz' }
    }
    case 'create_task': {
      const t = await createTask(sb, { ...p.args, course_id: p.args.course_id ?? chat.course_id })
      return { itemId: t.id, itemKind: 'task' }
    }
  }
}
