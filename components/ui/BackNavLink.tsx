'use client'
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { isRecording } from '@/lib/lectures/recordingGuard'
import { canGoBack, readStack } from '@/lib/ui/backStack'

const noop = () => () => {}

// A back button that leads to the page the student came from, and to `href` when there is none (a page opened from a link or a new tab).
// It is still a link to `href`, so opening it in a new tab or with a long press goes there. `labelBack` is what it says when it goes back
// to the previous page, as the page above may not be where it leads. Like the rest of the app's navigation, it asks before leaving a recording.
export function BackNavLink({ href, className, children, labelBack, ...rest }: Omit<React.ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string; labelBack?: React.ReactNode }) {
  const router = useRouter()
  const confirm = useConfirm()
  const goesBack = useSyncExternalStore(noop, () => canGoBack(readStack()), () => false)
  return (
    <Link href={href} className={className} {...rest} onClick={e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const leave = () => { if (goesBack) router.back(); else router.push(href) }
      if (isRecording()) {
        e.preventDefault()
        void confirm({ title: 'Stop recording?', confirmLabel: 'Leave', danger: true, body: 'Leaving this page stops the recording. What was recorded is kept on this device; save it from Lectures.' }).then(ok => { if (ok) leave() })
      } else if (goesBack) { e.preventDefault(); leave() }
    }}>{goesBack && labelBack ? labelBack : children}</Link>
  )
}
