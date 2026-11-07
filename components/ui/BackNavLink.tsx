'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { canGoBack, readStack } from '@/lib/ui/backStack'

// A back button that leads to the page the student came from, and to `href` when there is none (a page opened from a link or a new tab).
// It is still a link to `href`, so opening it in a new tab or with a long press goes there.
export function BackNavLink({ href, className, children, ...rest }: Omit<React.ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string }) {
  const router = useRouter()
  return (
    <Link href={href} className={className} {...rest} onClick={e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (canGoBack(readStack())) { e.preventDefault(); router.back() }
    }}>{children}</Link>
  )
}
