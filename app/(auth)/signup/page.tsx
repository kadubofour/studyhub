'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim().toLowerCase() !== email2.trim().toLowerCase()) { setError('Those emails don\'t match.'); return }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return }
    setBusy(true); setError(null)
    const { error } = await supabase().auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
    })
    setBusy(false)
    if (error) { setError(error.message.includes('registered') ? 'That email already has an account. Log in instead.' : 'Couldn\'t create your account. Try again.'); return }
    router.replace(`/onboarding?next=${encodeURIComponent(next)}`)
    router.refresh()
  }

  async function google() {
    await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

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
        <label className="field"><span>Password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
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
