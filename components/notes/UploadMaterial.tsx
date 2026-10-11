'use client'
import { useEffect, useState } from 'react'
import { UploadDialog } from '@/components/notes/UploadDialog'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import type { Course } from '@/lib/types'

// The upload dialog for any page: it fetches the student's courses when it is opened
// The notes list is told when a note was made
const NOTES_CHANGED = 'studyhub:notes-changed'
export function UploadMaterial({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (files: File[]) => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  useEffect(() => {
    if (!open) return
    let live = true
    listCourses(supabase()).then(c => { if (live) setCourses(c) }).catch(() => {})
    return () => { live = false }
  }, [open])
  return <UploadDialog open={open} onClose={onClose} courses={courses} onScan={onScan} onImported={() => { window.dispatchEvent(new Event(NOTES_CHANGED)) }} />
}
