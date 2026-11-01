'use client'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

// A short piece of text that may hold maths ($x^2$, or $$…$$ on its own) or a little emphasis, drawn the way the notes draw it and left in the
// line it sits in: an answer choice, a feedback line, an explanation. Plain text comes out as it went in.
export function MathText({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children: inner }) => <>{inner}</> }}>
      {children}
    </ReactMarkdown>
  )
}
