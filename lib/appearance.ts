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
