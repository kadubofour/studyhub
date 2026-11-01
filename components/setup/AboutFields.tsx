'use client'
import { Dropdown } from '@/components/ui/Dropdown'

export type About = { school: string; programme: string; year: string }
export const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Postgraduate']

// Where the student studies: the school, the programme and the year, from which the courses are suggested
export function AboutFields({ value, onChange }: { value: About; onChange: (v: About) => void }) {
  return (
    <>
      <label className="field"><span>School</span>
        <input value={value.school} maxLength={80} onChange={e => onChange({ ...value, school: e.target.value })} placeholder="University of Ghana" />
      </label>
      <label className="field"><span>Programme</span>
        <input value={value.programme} maxLength={80} onChange={e => onChange({ ...value, programme: e.target.value })} placeholder="BSc Biology" />
      </label>
      <div className="field"><span>Year</span>
        <Dropdown label="Year" value={value.year} onChange={year => onChange({ ...value, year })}
          options={[{ value: '', label: 'Not sure' }, ...YEARS.map(y => ({ value: y, label: y }))]} />
      </div>
    </>
  )
}
