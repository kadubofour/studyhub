import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { AppShell } from '@/components/shell/AppShell'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single<Profile>()
  if (!profile) redirect('/login')
  if (!profile.onboarded) redirect('/onboarding')
  return (
    <ProfileProvider initial={profile}>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </ProfileProvider>
  )
}
