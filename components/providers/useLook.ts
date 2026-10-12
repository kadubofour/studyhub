'use client'
import { useTheme } from 'next-themes'
import { effectiveLook, type LookName } from '@/lib/appearance'
import { useProfile } from './ProfileProvider'

// The look the app is drawn in: the student's choice, except Paper shows as Classic in dark mode
export function useLook(): LookName {
  const { profile } = useProfile()
  return effectiveLook(profile.look, useTheme().resolvedTheme)
}
