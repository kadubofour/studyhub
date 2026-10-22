import type { ResponseInputContent } from 'openai/resources/responses/responses'
import type { Attachment } from '@/lib/tutor/attachments'

// What the model reads for a message's attachments: photos as images, PDFs as files, documents as tagged material.
// `files` holds each fetched photo or PDF, base64, by its storage path; one that could not be fetched is left out.
const safe = (s: string) => s.replace(/"/g, "'").replace(/</g, '‹').replace(/>/g, '›')

export function attachmentParts(list: Attachment[], files: Map<string, string>): ResponseInputContent[] {
  return list.flatMap((a): ResponseInputContent[] => {
    if (a.kind === 'document') {
      const note = a.shortened ? ' (shortened: only the start of the file)' : ''
      return [{ type: 'input_text', text: `<attachment name="${safe(a.name)}">${note}\n${a.text}\n</attachment>` }]
    }
    const data = files.get(a.path)
    if (!data) return []
    return a.kind === 'photo'
      ? [{ type: 'input_image', image_url: `data:image/jpeg;base64,${data}`, detail: 'high' }]
      : [{ type: 'input_file', filename: a.name, file_data: `data:application/pdf;base64,${data}` }]
  })
}
