'use client'
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { effectiveLook, type LookName } from '@/lib/appearance'
import { useProfile } from './ProfileProvider'

const noopSubscribe = () => () => {}

// The look the app is drawn in: the student's choice, except Paper shows as Classic in dark mode.
// The theme is only trusted once the page has mounted: the server cannot know it, and the first client render must match the server's.
export function useLook(): LookName {
  const { profile } = useProfile()
  const { resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  return effectiveLook(profile.look, mounted ? resolvedTheme : undefined)
}
