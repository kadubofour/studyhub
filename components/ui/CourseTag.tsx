import { BookOpen } from 'lucide-react'
import type { Course } from '@/lib/types'

// Course shown as coloured text with a book icon (no pill)
export function CourseTag({ course, className = '' }: { course?: Course | null; className?: string }) {
  if (!course) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${className}`} style={{ color: course.color }}>
      <BookOpen size={12} aria-hidden />{course.name}
    </span>
  )
}
