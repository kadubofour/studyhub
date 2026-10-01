'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
    })
    setSent(true) // same message whether or not the account exists
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Reset your password</h1>
      {sent ? <p className="text-sm text-muted">If that email has an account, a reset link is on its way.</p> : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="field"><span>Email</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <button className="btn-primary w-full">Send reset link</button>
        </form>
      )}
      <Link href="/login" className="text-sm text-accent">Back to log in</Link>
    </div>
  )
}
