import { localStore, useLocalStore } from '@/lib/ui/localStore'

/** What the focus timer does when time is up: all kept on this device */
export interface FocusPrefs {
  /** A short chime, and a vibration on a phone */
  sound: boolean
  /** A browser notification (only works once the browser has allowed it) */
  notify: boolean
  /** A finished session rolls straight into the next one, already running */
  autoStart: boolean
}

export const DEFAULT_PREFS: FocusPrefs = { sound: true, notify: false, autoStart: false }

const parse = (v: unknown): FocusPrefs => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const flag = (k: keyof FocusPrefs) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_PREFS[k])
  return { sound: flag('sound'), notify: flag('notify'), autoStart: flag('autoStart') }
}

export const focusPrefs = localStore<FocusPrefs>('studyhub.focus.prefs', DEFAULT_PREFS, parse)
export const setFocusPrefs = (patch: Partial<FocusPrefs>) => focusPrefs.set({ ...focusPrefs.get(), ...patch })
export const useFocusPrefs = () => useLocalStore(focusPrefs)
