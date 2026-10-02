'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { saveWithRollback } from '@/lib/ui/save'

type Action = { label: string; onClick: () => void }
type ToastFn = (message: string, action?: Action) => void
const Ctx = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; action?: Action } | null>(null)
  const show = useCallback<ToastFn>((message, action) => {
    const id = Date.now()
    setToast({ id, message, action })
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), 6000)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-fg px-4 py-2 text-sm text-bg md:bottom-6">
          {toast.message}
          {toast.action && (
            <button className="font-medium underline" onClick={() => { toast.action!.onClick(); setToast(null) }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)

export function useSaver() {
  const toast = useToast()
  return useCallback((apply: () => void, rollback: () => void, run: () => Promise<unknown>) =>
    saveWithRollback({ apply, rollback, run, onFail: retry => toast('Couldn\'t save.', { label: 'Retry', onClick: retry }) }),
  [toast])
}
