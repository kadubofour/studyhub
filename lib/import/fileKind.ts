export type FileKind = 'pdf' | 'docx' | 'pptx' | 'text' | 'image' | 'audio'

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf', docx: 'docx', pptx: 'pptx', txt: 'text', md: 'text', markdown: 'text',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp3: 'audio', m4a: 'audio', wav: 'audio', webm: 'audio', ogg: 'audio', mp4: 'audio', mov: 'audio',
}
const BY_TYPE: Record<string, FileKind> = {
  'application/pdf': 'pdf', 'text/plain': 'text', 'text/markdown': 'text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

// What a picked file is, from its extension (else its media type when the name has none); null when Studyhub can't read it
export function fileKind(file: Pick<File, 'name' | 'type'>): FileKind | null {
  const dot = file.name.lastIndexOf('.')
  if (dot > 0 && dot < file.name.length - 1) return BY_EXTENSION[file.name.slice(dot + 1).toLowerCase()] ?? null
  if (BY_TYPE[file.type]) return BY_TYPE[file.type]
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/') || file.type.startsWith('video/')) return 'audio'
  return null
}
