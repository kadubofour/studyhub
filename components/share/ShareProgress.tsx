'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, Share2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { BTN_SOFT } from '@/components/ui/buttonStyles'
import { useToast } from '@/components/providers/ToastProvider'
import { ProgressCard } from '@/components/share/ProgressCard'
import type { SharedProgress } from '@/components/share/SharedView'
import { supabase } from '@/lib/supabase/client'
import { progressSnapshot, shareProgress } from '@/lib/data/shares'
import { cardPng } from '@/lib/share/cardImage'

const FILE_NAME = 'studyhub-progress.png'

function problem(e: unknown) {
  return e instanceof Error && e.message === 'rate_limited'
    ? 'Too many cards made in the last hour. Try again later.'
    : "Couldn't make your card. Check your connection."
}

/**
 * The student's progress as a card to post: opening it makes a snapshot of the numbers now with its own link, shows the
 * card, and draws it as a picture to share (where the device can share files), download, or send as a link.
 * Mount it to open it; onClose unmounts it.
 */
export function ShareProgressDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const svgRef = useRef<SVGSVGElement>(null)
  const [token, setToken] = useState<string | null>(null)
  const [snap, setSnap] = useState<SharedProgress | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // what the last action did, said in the dialog (a toast sits behind a modal); the next action clears it
  const [notice, setNotice] = useState('')

  // One card (and one link) each time the dialog opens
  useEffect(() => {
    let current = true
    const sb = supabase()
    shareProgress(sb)
      .then(async t => {
        if (!current) return
        setToken(t)
        const s = await progressSnapshot(sb, t)
        if (!current) return
        if (s) setSnap(s); else setError(problem(null))
      })
      .catch(e => { if (current) setError(problem(e)) })
    return () => { current = false }
  }, [])

  // Draw the picture as soon as the card is on screen, so Share opens the sheet straight from the tap
  useEffect(() => {
    const svg = svgRef.current
    if (!snap || !svg) return
    let current = true
    cardPng(svg)
      .then(png => { if (current) setFile(new File([png], FILE_NAME, { type: 'image/png' })) })
      .catch(() => { if (current) setError("Couldn't draw the picture. You can still copy the link.") })
    return () => { current = false }
  }, [snap])

  const url = token ? `${location.origin}/s/${token}` : ''
  const canShareFile = !!file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    setNotice(''); setError(null)
    try {
      await navigator.share({ files: [file], url, title: 'My progress on Studyhub' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // closed the sheet
      setError("Couldn't open sharing. Download the picture instead.")
    }
  }
  function download() {
    if (!file) return
    setError(null)
    const href = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = href; a.download = FILE_NAME
    document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
    setNotice('Picture downloaded')
  }
  async function copy() {
    setNotice(''); setError(null)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      setNotice('Link copied'); toast('Link copied')
    } catch { setError("Couldn't copy. Select the link and copy it.") }
  }

  return (
    <Dialog open onClose={onClose} title="Share my progress" icon={Share2} size="md"
      subtitle="A card of your numbers now. Anyone with the link sees this card.">
      {snap ? (
        <ProgressCard ref={svgRef} snapshot={snap} className="mx-auto block h-auto w-full max-w-[18rem] rounded-xl border border-line" />
      ) : !error && <p className="py-6 text-center text-sm text-muted" aria-live="polite">Making your card…</p>}
      {token && (
        <label className="field mt-4">
          <span>Link</span>
          <input type="text" readOnly aria-label="Link" value={url} onFocus={e => e.currentTarget.select()} />
        </label>
      )}
      <p role="status" className={notice ? 'mt-2 text-sm text-muted' : 'sr-only'}>{notice}</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <DialogFooter>
        {canShareFile && <button type="button" className="btn" onClick={share}><Share2 size={14} aria-hidden />Share</button>}
        {snap && <button type="button" className="btn" disabled={!file} onClick={download}><Download size={14} aria-hidden />Download picture</button>}
        {token && <button type="button" className="btn-primary" onClick={copy}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}Copy link</button>}
        <button type="button" className="btn" onClick={onClose}>Done</button>
      </DialogFooter>
    </Dialog>
  )
}

/** The Share my progress button, with its dialog */
export function ShareProgressButton({ className = BTN_SOFT }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}><Share2 size={15} aria-hidden />Share my progress</button>
      {open && <ShareProgressDialog onClose={() => setOpen(false)} />}
    </>
  )
}
