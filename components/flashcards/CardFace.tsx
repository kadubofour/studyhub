import { MarkdownView } from '@/components/notes/MarkdownView'

export function CardFace({ text }: { text: string }) {
  return <MarkdownView source={text} className="text-base" />
}
