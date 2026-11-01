import { BookOpenCheck, ClipboardList, FileText, HelpCircle } from 'lucide-react'

// Each way to start a chat has its small icon, the same on the Tutor page and in an empty chat
export const STARTER_ICONS = { explain: HelpCircle, quiz: ClipboardList, revise: BookOpenCheck, summarise: FileText } as const
