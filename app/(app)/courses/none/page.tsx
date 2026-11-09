'use client'
import { useEffect, useState } from 'react'
import { BackLink } from '@/components/ui/BackLink'
import { PAGE_TITLE } from '@/components/ui/PageHeader'
import { MaterialBrowser } from '@/components/library/MaterialBrowser'
import { NewNoteButton } from '@/components/quick/NewNoteButton'
import { requestUpload } from '@/lib/scan/events'
import { supabase } from '@/lib/supabase/client'
import { loadLibrary } from '@/lib/data/library'
import { summaryLine } from '@/lib/course/summary'
import { NO_COURSE_LABEL, type LibraryItem } from '@/lib/library/items'
import { Upload } from 'lucide-react'

// Everything that is in no course: the same space as a course's page, so nothing a student made can be lost for want of one
export default function NoCoursePage() {
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  useEffect(() => {
    let live = true
    loadLibrary(supabase(), new Date()).then(l => { if (live) setItems(l.filter(i => i.course_id === null)) }).catch(() => {})
    return () => { live = false }
  }, [])
  return (
    <div className="space-y-4">
      <BackLink href="/courses">Courses</BackLink>
      <header className="card flex flex-wrap items-center justify-between gap-3 border-l-8" style={{ borderLeftColor: 'var(--muted)' }}>
        <div className="min-w-0">
          <h1 className={`${PAGE_TITLE} truncate`}>{NO_COURSE_LABEL}</h1>
          <p className="text-sm text-muted">{items ? summaryLine(items) || 'Nothing here yet' : 'Notes, decks and files that are in no course'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewNoteButton courseId={null} className="btn" />
          <button type="button" className="btn" onClick={requestUpload}><Upload size={14} aria-hidden />Upload</button>
        </div>
      </header>
      <MaterialBrowser course="none" embedded />
    </div>
  )
}
