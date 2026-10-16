import type { Mode } from '@/lib/timer'

// The colour of each kind of session on the Focus page. A focus session uses the student's own accent colour; the breaks have their own, so a glance
// says which one it is. app/globals.css has the same values under `.mode-short` and `.mode-long` (tests/unit/modeColors.test.ts keeps the two together).
export interface ModeColors { solid: string; glow: string; text: string; soft: string; textDark: string; softDark: string }

export const MODE_COLORS: Record<Exclude<Mode, 'focus'>, ModeColors> = {
  short: { solid: '#0b8574', glow: '#34c9ae', text: '#0a6e60', soft: '#e1f5f0', textDark: '#5fe0c8', softDark: '#10332d' }, // calm green
  long: { solid: '#b45f06', glow: '#f2a33b', text: '#8f4a00', soft: '#fdefd9', textDark: '#ffb454', softDark: '#3a2810' }, // warm amber
}

/** The class that gives a page its session colours (nothing for focus: it keeps the student's accent) */
export const modeClass = (mode: Mode): string => (mode === 'focus' ? '' : `mode-${mode}`)
