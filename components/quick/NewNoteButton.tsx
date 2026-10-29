'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus } from 'lucide-react'
import { useToast } from '@/components/providers/ToastProvider'
import { BTN_OUTLINE } from '@/components/ui/buttonStyles'
import { supabase } from '@/lib/supabase/client'
import { createNote } from '@/lib/data/notes'

// Makes a note (in a course when it has one) and opens it, from anywhere
export function NewNoteButton({ courseId = null, className = BTN_OUTLINE }: { courseId?: string | null; className?: string }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  async function make() {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try {
      const n = await createNote(supabase(), { course_id: courseId })
      router.push(`/notes/${n.id}`)
    } catch { toast('Couldn\'t create a note.'); busyRef.current = false; setBusy(false) }
  }
  return <button type="button" className={className} disabled={busy} onClick={() => { void make() }}><FilePlus size={15} aria-hidden />New note</button>
}
