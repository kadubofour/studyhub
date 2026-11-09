import { quotePassage } from '@/lib/tutor/explainSelection'

// What the PDF viewer works out: how sharply to draw a page, and what to ask the tutor when the student presses Explain

/** What the student wants explained: the words they selected, or the page they are on (text is empty on a scanned page) */
export type PdfPart = { page: number; text: string; picked: boolean }

const MOST_PIXELS = 12_000_000 // phones refuse or blank out a canvas much bigger than this
const SHARPEST = 2.5

/** How many canvas pixels to draw per pixel on screen: the screen's own density, less when a page is zoomed very large */
export function pixelsPerPoint(width: number, height: number, density: number): number {
  const sharp = Math.min(Math.max(density || 1, 1), SHARPEST)
  return Math.min(sharp, Math.sqrt(MOST_PIXELS / Math.max(width * height, 1)))
}

// Asked the same way as Explain on a note. The tutor finds the file itself by the name in the message
export function explainMessage(fileName: string, { page, text, picked }: PdfPart): string {
  const where = `page ${page} of “${fileName}”`
  const ask = `Explain ${picked ? `this from ${where}` : where}, step by step, in simple terms`
  return text.trim() ? `${ask}:\n\n${quotePassage(text)}` : `${ask}.`
}
