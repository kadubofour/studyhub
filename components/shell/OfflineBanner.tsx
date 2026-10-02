'use client'
import { useOnline } from '@/lib/ui/useOnline'

export function OfflineBanner() {
  return useOnline() ? null : (
    <div role="status" className="bg-danger-soft px-4 py-1.5 text-center text-sm text-danger">You&apos;re offline</div>
  )
}
