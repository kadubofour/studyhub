'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { PasswordField } from '@/components/ui/PasswordField'
import { safeNext } from '@/lib/safeNext'

function SignupForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  // Where the confirmation link lands: the callback signs them in, then onboarding (keeping `next`)
  const confirmUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) { setError('Those emails don\'t match.'); return }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return }
    setBusy(true); setError(null)
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(), password,
      options: {
        emailRedirectTo: confirmUrl(),
        data: { full_name: name.trim() || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    })
    setBusy(false)
    if (error) { setError(error.message.includes('registered') ? 'That email already has an account. Log in instead.' : 'Couldn\'t create your account. Try again.'); return }
    // With email confirmation on (the hosted app), there's no session until they click the link
    if (!data.session) { setSentTo(email.trim()); return }
    router.replace(`/onboarding?next=${encodeURIComponent(next)}`)
    router.refresh()
  }

  async function google() {
    await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  if (sentTo) return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-medium">Check your email</h1>
      <p className="text-sm text-muted">We sent a link to <b>{sentTo}</b>. Open it to finish creating your account.</p>
      <button type="button" className="btn" onClick={async () => {
        await supabase().auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: confirmUrl() } })
        setResent(true)
      }}>Resend email</button>
      {resent && <p className="text-sm text-muted" aria-live="polite">Sent again.</p>}
      <p className="text-sm"><button type="button" className="text-accent" onClick={() => { setSentTo(null); setResent(false) }}>Use a different email</button></p>
    </div>
  )

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium">Create your account</h1>
      <button type="button" onClick={google} className="btn w-full">Continue with Google</button>
      <div className="text-center text-xs text-muted">or</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="field"><span>Name</span>
          <input autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ama" />
        </label>
        <label className="field"><span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setError(null) }} />
        </label>
        <label className="field"><span>Confirm email</span>
          <input type="email" required autoComplete="off" value={email2} onChange={e => { setEmail2(e.target.value); setError(null) }} onPaste={e => e.preventDefault()} />
        </label>
        <PasswordField label="Password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="text-sm text-muted">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent">Log in</Link></p>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
