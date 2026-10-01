'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function ResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    const { error } = await supabase().auth.updateUser({ password })
    if (error) { setError('Couldn\'t update your password. Request a new link.'); return }
    router.replace('/home')
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h1 className="text-xl font-medium">Choose a new password</h1>
      <label className="field"><span>New password</span>
        <input type="password" required minLength={8} value={password} onChange={e => { setPassword(e.target.value); setError(null) }} />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full">Save password</button>
    </form>
  )
}
