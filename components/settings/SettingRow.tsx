// One setting: what it is on the left, the control on the right (stacked on a phone)
export function SettingRow({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
