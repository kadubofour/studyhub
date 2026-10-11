export const MAX_TEXT_BYTES = 1024 * 1024

// A plain text or Markdown file → note Markdown. The title is the first heading, else the file name.
export function textToNote(buf: ArrayBuffer, fileName: string): { title: string; content_md: string } {
  if (buf.byteLength > MAX_TEXT_BYTES) throw new Error('Text files can be up to 1 MB.')
  const text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
  const heading = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(text)?.[1]?.trim()
  return { title: heading || fileName.replace(/\.[^.]+$/, '').trim() || 'Imported note', content_md: text }
}
