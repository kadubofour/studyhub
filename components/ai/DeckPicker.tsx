'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import type { Deck } from '@/lib/types'
import { Dropdown } from '@/components/ui/Dropdown'

export type DeckChoice = { kind: 'existing'; id: string } | { kind: 'new'; name: string }

export async function resolveDeck(sb: SupabaseClient, choice: DeckChoice): Promise<string> {
  if (choice.kind === 'existing') return choice.id
  return (await createDeck(sb, { name: choice.name.trim() || 'New deck' })).id
}

// Pick an existing deck, or make a new one (named after the note by default)
export function DeckPicker({ value, onChange }: { value: DeckChoice; onChange: (c: DeckChoice) => void }) {
  const [decks, setDecks] = useState<Deck[]>([])
  useEffect(() => { listDecksWithDue(supabase(), new Date()).then(setDecks).catch(() => {}) }, [])
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="field min-w-40 flex-1"><span>Deck</span>
        <Dropdown label="Deck" value={value.kind === 'new' ? '__new' : value.id}
          onChange={v => onChange(v === '__new' ? { kind: 'new', name: value.kind === 'new' ? value.name : '' } : { kind: 'existing', id: v })}
          options={[{ value: '__new', label: 'New deck…' }, ...decks.map(d => ({ value: d.id, label: d.name }))]} />
      </div>
      {value.kind === 'new' && (
        <label className="field min-w-40 flex-1"><span>New deck name</span>
          <input value={value.name} onChange={e => onChange({ kind: 'new', name: e.target.value })} />
        </label>
      )}
    </div>
  )
}
