import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { SIDEBAR_COOKIE } from '@/lib/ui/sidebarCookie'
import { createServerSupabase } from '@/lib/supabase/server'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { AppShell } from '@/components/shell/AppShell'
import { FocusProvider } from '@/components/providers/FocusProvider'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single<Profile>()
  if (!profile) redirect('/auth/signout?reason=profile')
  if (!profile.onboarded) {
    const here = (await headers()).get('x-pathname') ?? '/home'
    redirect(`/onboarding?next=${encodeURIComponent(here)}`)
  }
  return (
    <ProfileProvider initial={profile}>
      <ToastProvider>
        <ConfirmProvider>
          <FocusProvider>
            <AppShell initialCollapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === '1'}>{children}</AppShell>
          </FocusProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ProfileProvider>
  )
}
