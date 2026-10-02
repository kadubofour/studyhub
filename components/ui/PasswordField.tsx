'use client'
import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> & {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

// Password input with a show/hide toggle (eye icon) inside the field
export function PasswordField({ label, value, onChange, ...input }: Props) {
  const id = useId()
  const [shown, setShown] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id} className="text-muted">{label}</label>
      <div className="relative">
        <input id={id} {...input} type={shown ? 'text' : 'password'} value={value} onChange={onChange}
          className="w-full rounded-xl border border-line bg-raised py-1.5 pl-3 pr-10 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft" />
        <button type="button" onClick={() => setShown(s => !s)} aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'} title={shown ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-fg">
          {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </div>
  )
}
