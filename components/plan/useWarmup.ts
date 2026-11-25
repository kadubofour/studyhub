'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postAi } from '@/components/ai/aiFetch'

// A quiz for a session (a Warm-up, or a Revise): 5 questions made from the topic's newest note, or from an uploaded file when it has no note, then opened
export function useWarmup() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  async function start(s: { id: string; noteId: string | null; materialId?: string | null }) {
    if (!s.noteId && !s.materialId) return
    setBusy(s.id); setError(null)
    const r = await postAi<{ id: string }>('/api/ai/quiz', { ...(s.noteId ? { noteId: s.noteId } : { materialId: s.materialId }), count: 5, types: ['mcq', 'true_false', 'short'] })
    setBusy(null)
    if (!r.ok) { setError({ code: r.error, message: r.message }); return }
    router.push(`/quiz/${r.value.id}`)
  }
  return { busy, error, start }
}
