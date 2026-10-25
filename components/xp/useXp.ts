'use client'
import { useCallback, useEffect, useState } from 'react'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { loadActivity, loadXpDays } from '@/lib/data/activity'
import { localDayKey } from '@/lib/dates'
import { summarize, type XpDay, type XpSummary } from '@/lib/xp/rules'
import { useProgressChanged } from '@/lib/xp/events'

// The student's XP, level, goals and streak. null while loading and if loading fails, so callers just show nothing.
// `key` changes when something that earns XP happened elsewhere (a focus session logged), so the numbers are read again.
export function useXp(key: number | string = 0) {
  const { profile } = useProfile()
  const tz = profile.timezone
  const [xp, setXp] = useState<XpSummary | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true
    const sb = supabase()
    // XP comes from the server; if only that fails, fall back to working it out here
    Promise.all([loadActivity(sb, tz), loadXpDays(sb).catch((): XpDay[] | undefined => undefined)])
      .then(([days, xpDays]) => { if (live) setXp(summarize(days, localDayKey(new Date(), tz), xpDays)) })
      .catch(() => { if (live) setXp(null) })
    return () => { live = false }
  }, [tz, version, key])

  const reload = useCallback(() => setVersion(v => v + 1), [])
  useProgressChanged(reload) // anything that earns XP says so once it is saved
  return { xp, reload }
}
