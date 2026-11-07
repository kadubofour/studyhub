'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { readStack, visit, writeStack } from '@/lib/ui/backStack'

// Remembers the pages visited in this tab, for the back buttons (see BackNavLink). Renders nothing.
export function NavTracker() {
  const path = usePathname()
  useEffect(() => { writeStack(visit(readStack(), path)) }, [path])
  return null
}
