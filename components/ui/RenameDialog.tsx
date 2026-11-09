'use client'
import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'

// A name to change, in a small box of its own: the name is selected, Enter saves, Esc leaves. A fresh form each time it opens, so nothing is left from the last.
export function RenameDialog({ open, title, label = 'Name', initial, maxLength = 200, onClose, onSave }: {
  open: boolean; title: string; label?: string; initial: string; maxLength?: number; onClose: () => void; onSave: (name: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {open && <RenameForm label={label} initial={initial} maxLength={maxLength} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function RenameForm({ label, initial, maxLength, onClose, onSave }: { label: string; initial: string; maxLength: number; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const clean = name.trim()
  return (
    <form onSubmit={e => { e.preventDefault(); if (clean && clean !== initial.trim()) onSave(clean); else onClose() }} className="space-y-3">
      <label className="field"><span>{label}</span><input autoFocus value={name} maxLength={maxLength} onFocus={e => e.currentTarget.select()} onChange={e => setName(e.target.value)} /></label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!clean}>Save</button>
      </div>
    </form>
  )
}
