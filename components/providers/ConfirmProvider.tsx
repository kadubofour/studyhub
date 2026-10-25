'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from '@/components/ui/Dialog'
import { appRoot } from '@/lib/ui/appRoot'

export type ConfirmOptions = { title: string; body?: string; confirmLabel?: string; danger?: boolean }
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>
const Ctx = createContext<ConfirmFn>(async () => false)

/**
 * In-app replacement for window.confirm(): some browsers and embedded views block native
 * pop-ups, which made confirm() answer "no" silently and actions like Delete do nothing.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { host: Element }) | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(o => new Promise<boolean>(resolve => {
    resolver.current?.(false) // a newer question replaces an unanswered one
    resolver.current = resolve
    setRequest({ ...o, host: appRoot() }) // drawn in the app's root, so it wears the look
  }), [])

  function answer(v: boolean) {
    resolver.current?.(v) // only the first answer counts (Cancel then the dialog's close event)
    resolver.current = null
    setRequest(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {request && createPortal(
        <Dialog open onClose={() => answer(false)} title={request.title}>
          {request.body && <p className="-mt-2 mb-4 text-sm text-muted">{request.body}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => answer(false)}>Cancel</button>
            <button type="button" autoFocus className={request.danger ? 'btn-danger' : 'btn-primary'} onClick={() => answer(true)}>
              {request.confirmLabel ?? 'OK'}
            </button>
          </div>
        </Dialog>,
        request.host,
      )}
    </Ctx.Provider>
  )
}

export const useConfirm = () => useContext(Ctx)
