'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { Profile } from '@/lib/types'

const Ctx = createContext<{ profile: Profile; setProfile: (p: Profile) => void } | null>(null)

export function ProfileProvider({ initial, children }: { initial: Profile; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initial)
  const { setTheme } = useTheme()
  useEffect(() => { setTheme(initial.theme) }, [initial.theme, setTheme])
  return <Ctx.Provider value={{ profile, setProfile }}>{children}</Ctx.Provider>
}

export function useProfile() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile outside ProfileProvider')
  return v
}
