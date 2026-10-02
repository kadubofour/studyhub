'use client'
import { useMemo, useState } from 'react'
import katex from 'katex'
import { Dialog } from '@/components/ui/Dialog'

export type EquationInit = { latex: string; display: boolean } | null

function render(latex: string, display: boolean): { html: string; error: boolean } {
  try {
    return { html: katex.renderToString(latex, { displayMode: display, throwOnError: true }), error: false }
  } catch {
    return { html: '', error: true }
  }
}

/** Write or edit an equation in LaTeX with a live preview. `initial` null means a new one. */
export function EquationDialog({ open, initial, onClose, onSave }: {
  open: boolean; initial: EquationInit; onClose: () => void; onSave: (latex: string, display: boolean) => void
}) {
  // Parent remounts this (key) per open, so the initial values are read once
  const [latex, setLatex] = useState(initial?.latex ?? '')
  const [display, setDisplay] = useState(initial?.display ?? false)
  const preview = useMemo(() => latex.trim() ? render(latex, display) : null, [latex, display])

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!latex.trim()) return
    onSave(latex.trim(), display)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit equation' : 'Insert equation'}>
      <form onSubmit={save} className="space-y-3">
        <label className="field"><span>LaTeX</span>
          <textarea className="font-mono text-[13px]" rows={3} autoFocus value={latex} placeholder="\frac{-b \pm \sqrt{b^2-4ac}}{2a}"
            onChange={e => setLatex(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={display} onChange={e => setDisplay(e.target.checked)} />Show on its own line
        </label>
        <div className="flex min-h-16 items-center justify-center overflow-x-auto rounded-xl border border-line bg-surface px-3 py-3" aria-label="Preview">
          {!preview ? <span className="text-xs text-muted">The preview appears here. Tip: type $x^2$ in a note to make an equation without this box.</span>
            : preview.error ? <p role="alert" className="text-sm text-danger">Can&apos;t read this LaTeX yet — check the braces.</p>
            : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!latex.trim()}>{initial ? 'Update' : 'Insert'}</button>
        </div>
      </form>
    </Dialog>
  )
}
