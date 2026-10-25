'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { BTN_OUTLINE } from '@/components/ui/buttonStyles'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { RemindersCard } from '@/components/settings/RemindersCard'
import { PlanCard } from '@/components/settings/PlanCard'
import { StorageCard } from '@/components/settings/StorageCard'
import { DataCard } from '@/components/settings/DataCard'
import { SettingRow } from '@/components/settings/SettingRow'
import { SETTINGS_SECTIONS, SettingsRail, type SectionId } from '@/components/settings/SettingsRail'
import { billingEnabled } from '@/components/billing/usePlan'
import { useProfile } from '@/components/providers/ProfileProvider'
import { supabase } from '@/lib/supabase/client'
import { clearTimer } from '@/lib/ui/timerStore'

// Settings: sections down the side, one shown at a time. Time zone, focus and note settings are on the Profile page.
export default function SettingsPage() {
  const { profile } = useProfile()
  const router = useRouter()
  const billing = billingEnabled()
  const asked = useSearchParams().get('section')
  const [section, setSection] = useState<SectionId>(() => {
    const found = SETTINGS_SECTIONS.find(s => s.id === asked && (billing || s.id !== 'plan'))
    return found ? found.id : 'appearance'
  })
  const current = SETTINGS_SECTIONS.find(s => s.id === section)!

  async function signOut() {
    // A shared device must not hand this student's running focus session to the next person
    clearTimer(window.localStorage, profile.id)
    window.localStorage.removeItem('studyhub.focus.ambient')
    await supabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <SettingsRail section={section} onSection={setSection} billing={billing} />
        <div className="min-w-0">
          <h2 className="section-label !mb-1">{current.label}</h2>
          <p className="mb-4 text-sm text-muted">{current.blurb}</p>
          {section === 'appearance' && <AppearanceCard />}
          {section === 'reminders' && <RemindersCard />}
          {section === 'plan' && <PlanCard />}
          {section === 'storage' && <StorageCard />}
          {section === 'data' && <DataCard />}
          {section === 'account' && (
            <div className="card divide-y divide-line p-0">
              <SettingRow title="Profile, focus and notes" hint="Light or dark mode, time zone, focus lengths and note settings are on your profile.">
                <Link href="/profile" className={BTN_OUTLINE}>Open profile</Link>
              </SettingRow>
              <SettingRow title="Legal" hint="The rules of using Studyhub and how your information is handled.">
                <div className="flex flex-wrap gap-2"><Link href="/terms" className={BTN_OUTLINE}>Terms</Link><Link href="/privacy" className={BTN_OUTLINE}>Privacy</Link></div>
              </SettingRow>
              <SettingRow title="Sign out" hint="Signs you out on this device.">
                <button type="button" className={BTN_OUTLINE} onClick={signOut}>Sign out</button>
              </SettingRow>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
