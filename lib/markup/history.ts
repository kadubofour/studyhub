import type { Mark } from './marks'

// Every change keeps the marks as they were, so Undo and Redo are just stepping between snapshots
export interface History { marks: Mark[]; past: Mark[][]; future: Mark[][] }

export const emptyHistory = (): History => ({ marks: [], past: [], future: [] })
const step = (h: History, marks: Mark[]): History => ({ marks, past: [...h.past, h.marks], future: [] })

export const addMark = (h: History, m: Mark): History => step(h, [...h.marks, m])
export const eraseMark = (h: History, id: string): History => (h.marks.some(m => m.id === id) ? step(h, h.marks.filter(m => m.id !== id)) : h)
export const clearMarks = (h: History): History => (h.marks.length ? step(h, []) : h)
export const undo = (h: History): History => (h.past.length ? { marks: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.marks, ...h.future] } : h)
export const redo = (h: History): History => (h.future.length ? { marks: h.future[0], past: [...h.past, h.marks], future: h.future.slice(1) } : h)
export const canUndo = (h: History) => h.past.length > 0
export const canRedo = (h: History) => h.future.length > 0
