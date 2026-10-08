'use client'
import { useParams } from 'next/navigation'
import { ChatView } from '@/components/tutor/ChatView'

export default function TutorChatPage() {
  const { id } = useParams<{ id: string }>()
  return <ChatView chatId={id} />
}
