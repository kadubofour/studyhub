export type Pt = [number, number]
export type SizeKey = 'S' | 'M' | 'L'
export type ToolKey = 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'eraser'

export const COLORS = [
  { name: 'Black', value: '#111827' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#9333ea' },
] as const

type Base = { id: string; color: string; size: SizeKey }
export type Mark =
  | (Base & { kind: 'pen' | 'highlighter'; points: Pt[] })
  | (Base & { kind: 'line' | 'arrow' | 'rect' | 'ellipse'; from: Pt; to: Pt })
  | (Base & { kind: 'text'; at: Pt; text: string })

/** Marks are kept in the picture's own pixels, so a mark sits in the same place whatever size it is shown at or saved at */
export function strokeWidth(size: SizeKey, imageWidth: number): number {
  const unit = Math.max(2, imageWidth / 300)
  return unit * { S: 1, M: 2.5, L: 5 }[size]
}
export const textSize = (size: SizeKey, imageWidth: number) => strokeWidth(size, imageWidth) * 5 + 10
export const HIGHLIGHT_ALPHA = 0.35
export const HIGHLIGHT_FACTOR = 4 // a highlighter is this many times thicker than the pen of the same size

let counter = 0
export const newId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`
