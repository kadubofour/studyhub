'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { createChat, findChat } from '@/lib/data/tutor'

// Opens the chat about this note or lecture (the newest one), or starts it
export function AskTutorButton({ target, title, courseId, className = 'btn' }: {
  target: { note_id: string } | { lecture_id: string }; title: string; courseId: string | null; className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function open() {
    setBusy(true)
    try {
      const sb = supabase()
      const chat = await findChat(sb, target) ?? await createChat(sb, { title: title.slice(0, 200) || 'New chat', ...target, course_id: courseId })
      router.push(`/tutor/${chat.id}`)
    } catch { setBusy(false) }
  }
  return <button type="button" className={className} disabled={busy} onClick={open}><MessagesSquare size={14} aria-hidden />Ask the tutor</button>
}
