import { describe, it, expect } from 'vitest'
import { adminClient, newUser } from './helpers'

// Every table that holds a student's rows has a user_id; deleting the sign-in must take them all
const OWNED = [
  'profiles', 'courses', 'classes', 'tasks', 'notes', 'decks', 'cards', 'reviews', 'focus_sessions', 'quizzes', 'quiz_attempts', 'lectures',
  'topics', 'topic_links', 'topic_resources', 'study_plans', 'study_plan_days', 'tutor_chats', 'tutor_messages', 'game_plays',
  'entitlements', 'payments', 'ai_charges', 'ai_requests', 'transcription_usage',
]

describe('deleting a sign-in', () => {
  it('takes every row the student owned with it, and leaves other students alone', async () => {
    const u = await newUser(), other = await newUser()
    const course = (await u.sb.from('courses').insert({ name: 'Bio', color: '#1D9E75' }).select('id').single()).data!.id as string
    const note = (await u.sb.from('notes').insert({ title: 'N', content_md: 'x', course_id: course }).select('id').single()).data!.id as string
    const deck = (await u.sb.from('decks').insert({ name: 'D' }).select('id').single()).data!.id as string
    await u.sb.from('cards').insert({ deck_id: deck, front: 'Q', back: 'A' })
    await u.sb.from('tasks').insert({ title: 'T' })
    await u.sb.from('game_plays').insert({ game: 'speed', score: 1, total: 4 })
    await u.sb.from('tutor_chats').insert({})
    await other.sb.from('notes').insert({ title: 'Theirs', content_md: 'y' })

    const admin = adminClient()
    const { error } = await admin.auth.admin.deleteUser(u.id)
    expect(error).toBeNull()

    for (const table of OWNED) {
      const key = table === 'profiles' ? 'id' : 'user_id'
      const { data, error: e } = await admin.from(table).select(key).eq(key, u.id)
      expect(e, table).toBeNull()
      expect(data, table).toEqual([])
    }
    void note
    const theirs = await admin.from('notes').select('title').eq('user_id', other.id)
    expect(theirs.data).toEqual([{ title: 'Theirs' }])
  })
})
