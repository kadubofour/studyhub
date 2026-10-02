'use client'

/** On/off switch (role="switch"); label it with the id of visible text. */
export function Switch({ checked, onChange, labelledBy, describedBy }: {
  checked: boolean; onChange: (v: boolean) => void; labelledBy: string; describedBy?: string
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${checked ? 'bg-accent-solid' : 'bg-line'}`}>
      <span aria-hidden className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}
