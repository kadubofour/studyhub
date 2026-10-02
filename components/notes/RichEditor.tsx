'use client'
import { EditorContent, useEditor } from '@tiptap/react'
import { Bold, Italic, Heading2, List, ListChecks, Code, Sigma } from 'lucide-react'
import { noteExtensions } from './extensions'

export function RichEditor({ markdown, onChange }: { markdown: string; onChange: (md: string) => void }) {
  const editor = useEditor({
    extensions: noteExtensions(),
    content: markdown,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose-note min-h-[50vh] outline-none py-3', 'aria-label': 'Note' } },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  })

  if (!editor) return null

  const tool = (label: string, Icon: typeof Bold, run: () => void, active = false) => (
    <button type="button" aria-label={label} title={label} onClick={run}
      className={`rounded p-1.5 ${active ? 'bg-surface text-fg' : 'text-muted hover:text-fg'}`}><Icon size={16} aria-hidden /></button>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-0.5 border-b border-line pb-1.5">
        {tool('Bold', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {tool('Italic', Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {tool('Heading', Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading'))}
        {tool('Bulleted list', List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {tool('Checklist', ListChecks, () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'))}
        {tool('Code', Code, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
        {tool('Equation', Sigma, () => {
          const latex = window.prompt('LaTeX', 'x^2')
          if (latex) editor.chain().focus().insertInlineMath({ latex }).run()
        })}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
