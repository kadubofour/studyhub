'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { appRoot } from '@/lib/ui/appRoot'
import { saveWithRollback } from '@/lib/ui/save'

type Action = { label: string; onClick: () => void }
type ToastFn = (message: string, action?: Action) => void
const Ctx = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; action?: Action; host: Element } | null>(null)
  const show = useCallback<ToastFn>((message, action) => {
    const id = Date.now()
    setToast({ id, message, action, host: appRoot() }) // drawn in the app's root, so it wears the look
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), action ? 20_000 : 6000) // a message with something to tap stays longer: the student may be coming back to it
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && createPortal(
        <div role="status" className="toast fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-fg px-5 py-2.5 text-sm text-bg shadow-[0_10px_30px_-10px_rgb(0_0_0/0.45)] md:bottom-6">
          {toast.message}
          {toast.action && (
            <button className="font-medium underline" onClick={() => { toast.action!.onClick(); setToast(null) }}>
              {toast.action.label}
            </button>
          )}
        </div>,
        toast.host,
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
