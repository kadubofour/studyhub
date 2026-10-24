// Accent colours and fonts students can choose in Settings.
// `solid` carries white text (buttons, hero card); `text`/`textDark` are for accent-coloured
// text on light/dark pages; `soft`/`softDark` are tinted backgrounds; `glow` is the hero gradient's far end.
export const ACCENTS = {
  blue: { label: 'Blue', solid: '#3B5BDB', text: '#3B5BDB', textDark: '#8DA2FB', soft: '#EEF1FD', softDark: '#1B2550', glow: '#7C5CFF' },
  violet: { label: 'Violet', solid: '#6741D9', text: '#6741D9', textDark: '#B19CFF', soft: '#F1ECFE', softDark: '#2A1D52', glow: '#D45FC0' },
  teal: { label: 'Teal', solid: '#0B7A5E', text: '#0B7A5E', textDark: '#4FD1A5', soft: '#E1F5EE', softDark: '#0F3A2E', glow: '#2B8FC4' },
  coral: { label: 'Coral', solid: '#C2410C', text: '#C2410C', textDark: '#FF9A6B', soft: '#FCEDE7', softDark: '#44200F', glow: '#D9861F' },
  pink: { label: 'Pink', solid: '#BE185D', text: '#BE185D', textDark: '#F58AB8', soft: '#FBEAF0', softDark: '#45152C', glow: '#E8613C' },
  amber: { label: 'Amber', solid: '#A15C07', text: '#A15C07', textDark: '#F5B544', soft: '#FAEEDA', softDark: '#3D2A08', glow: '#D9483B' },
} as const

export type AccentName = keyof typeof ACCENTS

export const FONTS = {
  sans: { label: 'Sans (Inter)', cssVar: '--font-inter' },
  rounded: { label: 'Rounded (Nunito)', cssVar: '--font-nunito' },
  serif: { label: 'Serif (Lora)', cssVar: '--font-lora' },
  readable: { label: 'Easy to read (Atkinson)', cssVar: '--font-atkinson' },
  mono: { label: 'Mono (JetBrains)', cssVar: '--font-jetbrains' },
} as const

export type FontName = keyof typeof FONTS

export const isAccent = (v: unknown): v is AccentName => typeof v === 'string' && v in ACCENTS
export const isFont = (v: unknown): v is FontName => typeof v === 'string' && v in FONTS

// The looks. The colours here are the ones in app/globals.css (tests/unit/lookCss.test.ts keeps them in
// step); they exist in TypeScript so contrast can be checked and the Settings previews can show them.
export type ModeColors = { bg: string; raised: string; surface: string; line: string; fg: string; muted: string; tiles: [string, string, string] }

export const LOOKS = {
  ink: {
    label: 'Ink', blurb: 'Warm paper, black ink buttons, serif titles',
    light: { bg: '#F7F6F0', raised: '#FFFFFF', surface: '#F0EEE6', line: '#E4E2DA', fg: '#191918', muted: '#66655E', tiles: ['#ECE1FA', '#FAF0B4', '#CDEFF0'] },
    dark: { bg: '#151514', raised: '#1E1E1C', surface: '#262624', line: '#33322F', fg: '#F2F1EC', muted: '#A3A29B', tiles: ['#332B47', '#38331A', '#193A3C'] },
  },
  studio: {
    label: 'Studio', blurb: 'Midnight glass, lit by your colour',
    light: { bg: '#F5F6FB', raised: '#FFFFFF', surface: '#ECEEF6', line: '#DFE2EE', fg: '#151628', muted: '#5A5E80', tiles: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
    dark: { bg: '#0E0F1A', raised: '#171927', surface: '#1D2032', line: '#282B42', fg: '#ECEDF7', muted: '#9196B3', tiles: ['#171927', '#171927', '#171927'] },
  },
  classic: {
    label: 'Classic', blurb: 'Calm and minimal, dark sidebar',
    light: { bg: '#fbfbfa', raised: '#ffffff', surface: '#f3f3f0', line: '#e6e5e0', fg: '#1f1f1d', muted: '#6b6a65', tiles: ['#ffffff', '#ffffff', '#ffffff'] },
    dark: { bg: '#121211', raised: '#1a1a19', surface: '#222220', line: '#30302d', fg: '#ededea', muted: '#9a9993', tiles: ['#1a1a19', '#1a1a19', '#1a1a19'] },
  },
  paper: {
    label: 'Paper', blurb: 'Warm cream, softer edges',
    light: { bg: '#F6F0E4', raised: '#FFFBF2', surface: '#EFE7D6', line: '#E2D8C3', fg: '#2A2520', muted: '#6E6455', tiles: ['#F8E4D4', '#F7EDC4', '#DDEEE3'] },
    // Paper is for light mode only: in dark mode it is Classic (see effectiveLook), so these are Classic's dark colours
    dark: { bg: '#121211', raised: '#1a1a19', surface: '#222220', line: '#30302d', fg: '#ededea', muted: '#9a9993', tiles: ['#1a1a19', '#1a1a19', '#1a1a19'] },
  },
  vivid: {
    label: 'Vivid', blurb: 'Bold colour, dark sidebar, top bar',
    light: { bg: '#FAFAF8', raised: '#FFFFFF', surface: '#F1F1EE', line: '#E4E3DE', fg: '#1B1B1F', muted: '#5D5C66', tiles: ['#FFDCCB', '#CDEFE0', '#FFEBB0'] },
    dark: { bg: '#18181C', raised: '#212127', surface: '#2B2B33', line: '#3A3A44', fg: '#F2F2F5', muted: '#A9A9B6', tiles: ['#4D2B22', '#1E4034', '#4C3C12'] },
  },
  playful: {
    label: 'Playful', blurb: 'Chunky buttons, thick outlines',
    light: { bg: '#F7FBF4', raised: '#FFFFFF', surface: '#EAF2E5', line: '#CFDACA', fg: '#26301F', muted: '#556350', tiles: ['#FFEFBF', '#D6F1DD', '#D5E8FF'] },
    dark: { bg: '#131F24', raised: '#1E2D34', surface: '#26373F', line: '#3A4B54', fg: '#F0F6F9', muted: '#A9BBC4', tiles: ['#3D3515', '#1E3B2A', '#1C3447'] },
  },
} as const satisfies Record<string, { label: string; blurb: string; light: ModeColors; dark: ModeColors }>

export type LookName = keyof typeof LOOKS
export const isLook = (v: unknown): v is LookName => typeof v === 'string' && v in LOOKS
// An old cached profile, or a look this version doesn't know, shows Ink
export const lookOf = (v: unknown): LookName => (isLook(v) ? v : 'ink')

// Paper only looks right on light: in dark mode it shows as Classic (the student's choice is kept for when they go back to light)
export const effectiveLook = (look: unknown, resolvedTheme: string | undefined): LookName => {
  const l = lookOf(look)
  return l === 'paper' && resolvedTheme === 'dark' ? 'classic' : l
}
// The looks offered in Settings for the current theme
export const lookChoices = (resolvedTheme: string | undefined): LookName[] =>
  (Object.keys(LOOKS) as LookName[]).filter(l => !(l === 'paper' && resolvedTheme === 'dark'))

// How wide the app's content is: a centred column, a wide layout (the default), or the whole window
export const CONTENT_WIDTHS = [
  { id: 'focused', label: 'Focused' }, { id: 'wide', label: 'Wide' }, { id: 'full', label: 'Full' },
] as const
export type ContentWidth = (typeof CONTENT_WIDTHS)[number]['id']
export const contentWidthOf = (v: unknown): ContentWidth => (CONTENT_WIDTHS.some(w => w.id === v) ? (v as ContentWidth) : 'wide')

// Paper's serif greeting only while the student is on the default Sans font: their font choice wins
export const greetingFont = (look: unknown, font: unknown): string | undefined =>
  look === 'paper' && font === 'sans' ? 'var(--font-lora)' : undefined

// WCAG relative-luminance contrast ratio between two #rrggbb colours
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
