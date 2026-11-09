// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const back = vi.fn(), push = vi.fn()
let ok = true
const confirm = vi.fn(async () => ok)
vi.mock('next/navigation', () => ({ useRouter: () => ({ back, push }) }))
vi.mock('@/components/providers/ConfirmProvider', () => ({ useConfirm: () => confirm }))
import { BackLink } from '@/components/ui/BackLink'
import { setRecording } from '@/lib/lectures/recordingGuard'
import { writeStack } from '@/lib/ui/backStack'

beforeEach(() => { back.mockClear(); push.mockClear(); confirm.mockClear(); ok = true; sessionStorage.clear(); setRecording(false) })
afterEach(() => { cleanup(); setRecording(false) })

describe('the back link', () => {
  it('says the page above, as an ordinary link, when there is no page before', () => {
    render(<BackLink href="/library">Library</BackLink>)
    const a = screen.getByRole('link', { name: 'Library' })
    expect(a.getAttribute('href')).toBe('/library')
    fireEvent.click(a) // an ordinary link click: the link itself goes there
    expect(back).not.toHaveBeenCalled()
  })
  it('says Back, and goes to the page before, when there is one', () => {
    writeStack(['/tutor', '/courses/c1'])
    render(<BackLink href="/courses">Courses</BackLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Back' }))
    expect(back).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
  it('asks before leaving a recording, and stays if the student does', async () => {
    writeStack(['/home', '/lectures/record'])
    setRecording(true)
    ok = false
    render(<BackLink href="/lectures">Lectures</BackLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Back' }))
    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(back).not.toHaveBeenCalled()
    ok = true
    fireEvent.click(screen.getByRole('link', { name: 'Back' }))
    await waitFor(() => expect(back).toHaveBeenCalled())
  })
})
