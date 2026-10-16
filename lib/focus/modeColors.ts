import type { Mode } from '@/lib/timer'

// The colour of each kind of session on the Focus page. A focus session uses the student's own accent colour; the breaks have their own, so a glance
// says which one it is. They are deliberately not any of the accents a student can pick (lib/appearance.ts), or a break would look like focus. app/globals.css has the same values under `.mode-short` and `.mode-long` (tests/unit/modeColors.test.ts keeps the two together).
export interface ModeColors { solid: string; glow: string; text: string; soft: string; textDark: string; softDark: string }

export const MODE_COLORS: Record<Exclude<Mode, 'focus'>, ModeColors> = {
  short: { solid: '#4a7a0c', glow: '#9be02f', text: '#3d6b0a', soft: '#eef8d5', textDark: '#b4ea5a', softDark: '#1c2e08' }, // fresh lime green
  long: { solid: '#0c7490', glow: '#2bc4e6', text: '#0a6179', soft: '#def5fa', textDark: '#5fdcf2', softDark: '#0a2f3a' }, // cool sky blue
}

/** The class that gives a page its session colours (nothing for focus: it keeps the student's accent) */
export const modeClass = (mode: Mode): string => (mode === 'focus' ? '' : `mode-${mode}`)
