export type FileKind = 'pdf' | 'docx' | 'pptx' | 'text' | 'image' | 'audio'

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf', docx: 'docx', pptx: 'pptx', txt: 'text', md: 'text', markdown: 'text',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp3: 'audio', m4a: 'audio', wav: 'audio', webm: 'audio', ogg: 'audio', mp4: 'audio', mov: 'audio',
}

// What a picked file is, from its extension (else its media type); null when Studyhub can't read it
export function fileKind(file: Pick<File, 'name' | 'type'>): FileKind | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (file.name.includes('.') && BY_EXTENSION[ext]) return BY_EXTENSION[ext]
  if (file.name.includes('.') && ext) return null
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/') || file.type.startsWith('video/')) return 'audio'
  return null
}
