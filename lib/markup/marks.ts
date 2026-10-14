export type Pt = [number, number]

/** The brushes. Each one draws the same path of points in its own way (see draw.ts). */
export const BRUSHES = [
  { key: 'pen', label: 'Pen' },
  { key: 'pencil', label: 'Pencil' },
  { key: 'marker', label: 'Marker' },
  { key: 'highlighter', label: 'Highlighter' },
  { key: 'calligraphy', label: 'Calligraphy pen' },
  { key: 'dotted', label: 'Dotted line' },
] as const
export type BrushKind = (typeof BRUSHES)[number]['key']
export const isBrush = (v: unknown): v is BrushKind => BRUSHES.some(b => b.key === v)

/** What the drawing tool is set to: a brush, or one of the two erasers */
export type ToolKey = BrushKind | 'eraser' | 'rubber'

export const COLORS = [
  { name: 'Black', value: '#111827' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#9333ea' },
] as const

/** Thickness is any number from MIN_WIDTH to MAX_WIDTH, in the drawing's own units (the note is 1000 units wide) */
export const MIN_WIDTH = 1
export const MAX_WIDTH = 40
export const DEFAULT_WIDTH = 4

/** One stroke: a brush, a colour, a thickness and the points it passes through */
export type Mark = { id: string; brush: BrushKind; color: string; width: number; points: Pt[] }

/** How much thicker than its width setting each brush draws, so the same slider setting suits every brush */
export const BRUSH_REACH: Record<BrushKind, number> = { pen: 1, pencil: 1, marker: 1.6, highlighter: 3, calligraphy: 1.4, dotted: 1 }

let counter = 0
export const newId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`
