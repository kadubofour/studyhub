'use client'
import { Keyboard } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { GO_SHORTCUTS } from '@/lib/shell/shortcuts'

// The keyboard shortcuts, opened with ? from anywhere the student is not typing
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" icon={Keyboard} subtitle="Press them anywhere you are not typing." size="md">
      <dl className="grid gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 sm:col-span-2"><dt>Search or jump</dt><dd className="flex gap-1"><span className="kbd">Ctrl</span><span className="kbd">K</span></dd></div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2"><dt>Show this list</dt><dd><span className="kbd">?</span></dd></div>
        {GO_SHORTCUTS.map(s => (
          <div key={s.key} className="flex items-center justify-between gap-3"><dt>Go to {s.label}</dt><dd className="flex items-center gap-1"><span className="kbd">G</span><span className="text-xs text-muted">then</span><span className="kbd">{s.key.toUpperCase()}</span></dd></div>
        ))}
      </dl>
    </Dialog>
  )
}
