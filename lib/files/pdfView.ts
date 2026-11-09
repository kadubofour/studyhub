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

// Short enough to travel in the address to the chat. The whole file is read by the tutor too: it finds the file by the name in the message
const MOST_CHARS = 1500

export function explainMessage(fileName: string, { page, text, picked }: PdfPart): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const words = flat.length > MOST_CHARS ? `${flat.slice(0, MOST_CHARS)}…` : flat
  if (!words) return `Explain page ${page} of ${fileName} to me in plain words.`
  return picked
    ? `Explain this from page ${page} of ${fileName} to me in plain words:\n\n${words}`
    : `Explain page ${page} of ${fileName} to me in plain words. It says:\n\n${words}`
}
