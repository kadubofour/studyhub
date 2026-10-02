'use client'
import { useCallback, useState } from 'react'

// Sidebar collapsed/expanded, remembered per device in a cookie. A cookie (not localStorage) lets
// the server render the right layout on reload instead of flashing the sidebar in and out.
import { SIDEBAR_COOKIE } from './sidebarCookie'
export { SIDEBAR_COOKIE }

export function useSidebarCollapsed(initial: boolean): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState(initial)
  const set = useCallback((v: boolean) => {
    setCollapsed(v)
    document.cookie = `${SIDEBAR_COOKIE}=${v ? 1 : 0}; path=/; max-age=31536000; samesite=lax`
  }, [])
  return [collapsed, set]
}
