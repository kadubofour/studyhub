'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { PlanCard } from '@/components/settings/PlanCard'
import { StorageCard } from '@/components/settings/StorageCard'
import { DataCard } from '@/components/settings/DataCard'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { clearTimer } from '@/lib/ui/timerStore'

// Plan, storage, how the app looks and the student's data. Time zone, focus and note settings are on the Profile page.
export default function SettingsPage() {
  const { profile } = useProfile()
  const router = useRouter()

  async function signOut() {
    // A shared device must not hand this student's running focus session to the next person
    clearTimer(window.localStorage, profile.id)
    await supabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Settings" />
      <PlanCard />
      <StorageCard />
      <AppearanceCard />
      <p className="text-sm text-muted">Time zone, focus lengths and note settings are on your <Link href="/profile" className="text-accent underline">profile</Link>.</p>
      <DataCard />
      <div className="flex items-center justify-between gap-4">
        <p className="flex gap-4 text-xs text-muted"><Link href="/terms" className="hover:text-fg">Terms</Link><Link href="/privacy" className="hover:text-fg">Privacy</Link></p>
        <button type="button" className="btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
