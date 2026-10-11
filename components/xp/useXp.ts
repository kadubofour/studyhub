'use client'
import { useCallback, useEffect, useState } from 'react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { loadActivity } from '@/lib/data/activity'
import { localDayKey } from '@/lib/dates'
import { summarize, type XpSummary } from '@/lib/xp/rules'

// The student's XP, level, goals and streak. null while loading and if loading fails, so callers just show nothing.
export function useXp() {
  const { profile } = useProfile()
  const tz = profile.timezone
  const [xp, setXp] = useState<XpSummary | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true
    loadActivity(supabase(), tz)
      .then(days => { if (live) setXp(summarize(days, localDayKey(new Date(), tz))) })
      .catch(() => { if (live) setXp(null) })
    return () => { live = false }
  }, [tz, version])

  const reload = useCallback(() => setVersion(v => v + 1), [])
  return { xp, reload }
}
