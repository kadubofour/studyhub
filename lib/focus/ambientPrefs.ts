import { localStore, useLocalStore } from '@/lib/ui/localStore'

export const AMBIENT_SOUNDS = [{ id: 'off', label: 'Off' }, { id: 'rain', label: 'Rain' }, { id: 'sea', label: 'Ocean' }, { id: 'lofi', label: 'Lo-fi' }] as const
export type AmbientId = (typeof AMBIENT_SOUNDS)[number]['id']

/** The background sound and how loud: kept on this device, and playing wherever the student is in the app */
export interface AmbientPrefs { sound: AmbientId; volume: number }
export const DEFAULT_AMBIENT: AmbientPrefs = { sound: 'off', volume: 0.6 }

export function parseAmbient(v: unknown): AmbientPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const sound = AMBIENT_SOUNDS.find(s => s.id === o.sound)?.id ?? DEFAULT_AMBIENT.sound
  const volume = typeof o.volume === 'number' && Number.isFinite(o.volume) ? Math.min(1, Math.max(0, o.volume)) : DEFAULT_AMBIENT.volume
  return { sound, volume }
}

export const ambientPrefs = localStore<AmbientPrefs>('studyhub.focus.ambient', DEFAULT_AMBIENT, parseAmbient)
export const setAmbientPrefs = (patch: Partial<AmbientPrefs>) => ambientPrefs.set({ ...ambientPrefs.get(), ...patch })
export const useAmbientPrefs = () => useLocalStore(ambientPrefs)
