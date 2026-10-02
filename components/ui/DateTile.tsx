import { formatInTimeZone } from 'date-fns-tz'
import { localDayKey } from '@/lib/dates'

// A tiny tear-off calendar page: month band over the day number. Red band when overdue,
// accent band otherwise. Replaces the old pill-shaped due-date labels.
export function DateTile({ dueAt, tz, now }: { dueAt: string; tz: string; now: Date }) {
  const overdue = localDayKey(dueAt, tz) < localDayKey(now, tz)
  const d = new Date(dueAt)
  return (
    <span className="inline-flex w-9 shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-raised text-center leading-none"
      title={formatInTimeZone(d, tz, 'EEEE, MMM d')}>
      <span className={`py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white ${overdue ? 'bg-danger' : 'bg-accent-solid'}`}>
        {formatInTimeZone(d, tz, 'MMM')}
      </span>
      <span className="py-1 text-[13px] font-semibold">{formatInTimeZone(d, tz, 'd')}</span>
    </span>
  )
}
