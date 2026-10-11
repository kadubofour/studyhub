export const MAX_TEXT_BYTES = 1024 * 1024

// UTF-16 (Notepad's "Unicode") has a byte order mark; otherwise UTF-8, and old Windows files are not valid UTF-8, so they are read as Windows-1252
function decode(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2))
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2))
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b) } catch { return new TextDecoder('windows-1252').decode(b) }
}

// A plain text or Markdown file → note Markdown. The title is the first heading, else the file name.
// Markdown stays as written; plain text keeps its line breaks and indentation does not turn into code.
export function textToNote(buf: ArrayBuffer, fileName: string): { title: string; content_md: string } {
  if (buf.byteLength > MAX_TEXT_BYTES) throw new Error('Text files can be up to 1 MB.')
  let text = decode(buf).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  const heading = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(text)?.[1]?.trim()
  if (!/\.(md|markdown)$/i.test(fileName)) {
    text = text.split('\n').map(l => l.replace(/^[ \t]+/, '').replace(/\$/g, '\\$')).join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1  \n')
  }
  return { title: heading || fileName.replace(/\.[^.]+$/, '').trim() || 'Imported note', content_md: text }
}
