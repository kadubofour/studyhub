'use client'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useSaver } from '@/components/providers/ToastProvider'
import { Switch } from '@/components/ui/Switch'
import { updateProfile } from '@/lib/data/profile'
import { supabase } from '@/lib/supabase/client'
import { SettingRow } from './SettingRow'

// Whether friends and groups see the student's numbers. Off, they still see the boards themselves and keep their friends
// and groups; others see their name only in friend and member lists.
export function PrivacyCard() {
  const { profile, setProfile } = useProfile()
  const save = useSaver()
  const on = profile.show_on_boards !== false
  function set(v: boolean) {
    save(
      () => setProfile(p => ({ ...p, show_on_boards: v })),
      () => setProfile(p => ({ ...p, show_on_boards: !v })),
      () => updateProfile(supabase(), profile.id, { show_on_boards: v }),
    )
  }
  return (
    <div className="card divide-y divide-line p-0">
      <SettingRow title="Leaderboards" hint="Friends and study groups you are in see your level, streak and XP.">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div id="show-on-boards" className="text-sm font-medium">Show me on leaderboards</div>
            <p id="show-on-boards-hint" className="mt-0.5 text-xs text-muted">Off: you still see the boards and keep your friends and groups, but nobody else sees your numbers.</p>
          </div>
          <Switch checked={on} onChange={set} labelledBy="show-on-boards" describedBy="show-on-boards-hint" />
        </div>
      </SettingRow>
    </div>
  )
}
