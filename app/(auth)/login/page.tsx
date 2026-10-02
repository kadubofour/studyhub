'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { safeNext } from '@/lib/safeNext'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase().auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) { setError('That email and password don\'t match. Try again.'); return }
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
        <label className="field"><span>Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
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
