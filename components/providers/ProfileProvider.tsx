'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import type { Profile } from '@/lib/types'

const Ctx = createContext<{ profile: Profile; setProfile: (p: Profile) => void } | null>(null)

export function ProfileProvider({ initial, children }: { initial: Profile; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initial)
  const { setTheme } = useTheme()
  // Apply the saved theme once on load. next-themes gives a new setTheme after each change,
  // so depending on it would re-apply the old saved theme and undo the user's switch.
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    setTheme(initial.theme)
  }, [initial.theme, setTheme])
  return <Ctx.Provider value={{ profile, setProfile }}>{children}</Ctx.Provider>
}

export function useProfile() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile outside ProfileProvider')
  return v
}
