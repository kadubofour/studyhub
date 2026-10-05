'use client'

// Languages for the free live transcript (the browser's speech recognition listens in one
// language for the whole recording). Twi, Ga and Ewe aren't offered by browsers.
export const LIVE_LANGUAGES: [code: string, label: string][] = [
  ['en-GH', 'English (Ghana)'], ['en-NG', 'English (Nigeria)'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'],
  ['fr-FR', 'French'], ['es-ES', 'Spanish'], ['pt-PT', 'Portuguese'], ['de-DE', 'German'],
  ['ar-SA', 'Arabic'], ['sw-KE', 'Swahili'], ['zh-CN', 'Chinese (Mandarin)'],
]
const KEY = 'studyhub:live-language'
const DEFAULT = 'en-GH'

// Remembered on this device; storage can be unavailable (private mode), so fall back quietly
export function savedLiveLanguage(): string {
  try {
    const v = localStorage.getItem(KEY)
    return v && LIVE_LANGUAGES.some(([code]) => code === v) ? v : DEFAULT
  } catch { return DEFAULT }
}
export function saveLiveLanguage(code: string) {
  try { localStorage.setItem(KEY, code) } catch { /* not remembered, that's all */ }
}
