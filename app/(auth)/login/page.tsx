'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { PasswordField } from '@/components/ui/PasswordField'
import { safeNext } from '@/lib/safeNext'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    const e = params.get('error')
    if (e === 'profile') return 'We couldn\'t load your account. Log in again.'
    if (e === 'callback') return 'That sign-in link didn\'t work. Try again.'
    return null
  })
  const [busy, setBusy] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase().auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      const notConfirmed = (error as { code?: string }).code === 'email_not_confirmed'
      setUnconfirmed(notConfirmed)
      setError(notConfirmed ? 'Confirm your email first. We sent you a link when you signed up.' : 'That email and password don\'t match. Try again.')
      return
    }
    router.replace(next)
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
      <h1 className="text-xl font-medium">Log in</h1>
      <button type="button" onClick={google} className="btn w-full">Continue with Google</button>
      <div className="text-center text-xs text-muted">or</div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="field"><span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <PasswordField label="Password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {unconfirmed && (
          <button type="button" className="text-sm text-accent" onClick={async () => {
            await supabase().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } })
            setError('We sent a new confirmation link. Check your email.')
          }}>Resend confirmation email</button>
        )}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/forgot" className="text-muted hover:text-fg">Forgot password</Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent">Create account</Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
