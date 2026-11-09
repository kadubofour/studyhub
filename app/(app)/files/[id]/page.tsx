'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Download, ExternalLink, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { UploadDialog } from '@/components/notes/UploadDialog'
import { requestScan } from '@/lib/scan/events'
import { BackLink } from '@/components/ui/BackLink'
import { PageHeader } from '@/components/ui/PageHeader'
import { CourseTag } from '@/components/ui/CourseTag'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { supabase } from '@/lib/supabase/client'
import { listCourses } from '@/lib/data/courses'
import { deleteMaterial, fileSize, getMaterial, MATERIAL_LABEL, MATERIAL_MIME, materialFile, materialUrl, type Material } from '@/lib/data/materials'
import { createChat } from '@/lib/data/tutor'
import { PdfViewer } from '@/components/files/PdfViewer'
import { explainMessage, type PdfPart } from '@/lib/files/pdfView'
import type { Course } from '@/lib/types'
import { Working } from '@/components/ui/Working'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// An uploaded file kept in the Library: what it is, the note it became (or a way to make one), and a way to open, download or delete it.
// A PDF or a photo is shown here too, a PDF in the app's own viewer.
export default function FilePage() {
  const id = String(useParams<{ id: string }>().id)
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [file, setFile] = useState<Material | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [view, setView] = useState<string | null>(null)
  const [noLink, setNoLink] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  // the file, fetched to make a note from it
  const [making, setMaking] = useState<File | 'loading' | null>(null)
  const photo = !!file?.mime.startsWith('image/')

  useEffect(() => {
    const sb = supabase()
    let live = true
    getMaterial(sb, id).then(async m => {
      if (!live) return
      setFile(m)
      listCourses(sb).then(cs => { if (live) { setCourses(cs); setCourse(cs.find(c => c.id === m.course_id) ?? null) } }).catch(() => {})
      if (m.mime === MATERIAL_MIME.pdf || m.mime.startsWith('image/')) materialUrl(sb, m).then(u => { if (live) setView(u) }).catch(() => { if (live) setNoLink(true) })
    }).catch(() => router.replace('/library')) // deleted or someone else's file
    return () => { live = false }
  }, [id, router])

  // A fresh private link each time, so it never runs out while the page is open
  async function open(download: boolean) {
    if (!file) return
    try {
      const url = await materialUrl(supabase(), file, download)
      if (download) window.location.assign(url)
      else window.open(url, '_blank', 'noopener')
    } catch { toast('Couldn\'t open the file. Check your connection.') }
  }

  // A note from the kept file: a photo is read by Scan, a document in the upload dialog, which points this file at the new note
  async function makeNote() {
    if (!file || making) return
    setMaking('loading')
    try {
      const f = await materialFile(supabase(), file)
      if (photo) { setMaking(null); requestScan([f]) } else setMaking(f)
    } catch { setMaking(null); toast('Couldn\'t open the file. Check your connection.') }
  }

  // The tutor gets a chat of its own about this, with the question ready to send; its reply can then be explained visually like any other
  async function explain(part: PdfPart) {
    if (!file) return
    try {
      const chat = await createChat(supabase(), { title: file.name.slice(0, 200), course_id: file.course_id })
      router.push(`/tutor/${chat.id}?ask=${encodeURIComponent(explainMessage(file.name, part))}`)
    } catch { toast('Couldn\'t open the tutor. Check your connection.') }
  }

  async function remove() {
    if (!file) return
    const ok = await confirm({
      title: `Delete “${file.name}”?`, body: file.note_id ? 'The note made from it stays. This can\'t be undone.' : 'This can\'t be undone.',
      confirmLabel: 'Delete file', danger: true,
    })
    if (!ok) return
    try { await deleteMaterial(supabase(), file); router.replace('/library') } catch { toast('Couldn\'t delete the file.') }
  }

  return (
    <div>
      <BackLink href="/library">Library</BackLink>
      <PageHeader title={file?.name ?? 'File'} summary={file ? `${MATERIAL_LABEL[file.mime] ?? 'File'} · ${fileSize(file.bytes)} · Added ${day(file.created_at)}` : undefined} actions={file && <>
        {file.mime !== MATERIAL_MIME.pdf && <button type="button" className="btn" onClick={() => { void open(false) }}><ExternalLink size={14} aria-hidden />Open</button>}
        <button type="button" className="btn" onClick={() => { void open(true) }}><Download size={14} aria-hidden />Download</button>
        <button type="button" className="btn-ghost hover:!text-danger" onClick={() => { void remove() }}><Trash2 size={14} aria-hidden />Delete file</button>
      </>} />
      {!file ? <Working kind="load" size="sm" label="Loading" className="text-sm text-muted" /> : (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <span className="flex items-center gap-2"><span className="text-muted">Course</span>{course ? <CourseTag course={course} /> : <span className="text-xs">None</span>}</span>
            {file.note_id
              ? <Link href={`/notes/${file.note_id}`} className="btn ml-auto"><FileText size={14} aria-hidden />Open the note made from it</Link>
              : <button type="button" className="btn ml-auto" onClick={() => { void makeNote() }} disabled={making === 'loading'}>
                  {making === 'loading' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}Make a note from it</button>}
          </div>
          {view && (photo
            // eslint-disable-next-line @next/next/no-img-element -- a short-lived private link, which next/image cannot optimise
            ? <img src={view} alt={file.name} className="max-h-[75dvh] max-w-full rounded-2xl border border-line" />
            : <PdfViewer key={view} url={view} name={file.name} onExplain={explain} />)}
          {noLink && <p role="alert" className="text-sm text-muted">Couldn&apos;t show this file. Check your connection and open the page again.</p>}
        </div>
      )}
      {making instanceof File && file && (
        <UploadDialog open courses={courses} fromMaterial={{ id: file.id, file: making }} onClose={() => setMaking(null)}
          onImported={noteId => setFile(f => (f ? { ...f, note_id: noteId } : f))} />
      )}
    </div>
  )
}
