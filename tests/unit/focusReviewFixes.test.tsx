// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { logFocusSession } from '@/lib/data/focus'
import { ToastProvider, useToast } from '@/components/providers/ToastProvider'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('a session whose task or course has since been deleted', () => {
  it('is still saved, without the links', async () => {
    const calls: Record<string, unknown>[] = []
    const sb = { from: () => ({ upsert: async (row: Record<string, unknown>) => {
      calls.push(row)
      return row.task_id ? { error: { message: 'new row violates row-level security policy', code: '42501' } } : { error: null }
    } }) }
    await logFocusSession(sb as never, { startedAt: new Date(), endedAt: new Date(), minutes: 25, completed: true, taskId: 't-gone', courseId: 'c-gone' })
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ task_id: null, course_id: null, minutes: 25 })
  })
  it('still fails when it has no links to drop', async () => {
    const sb = { from: () => ({ upsert: async () => ({ error: { message: 'offline' } }) }) }
    await expect(logFocusSession(sb as never, { startedAt: new Date(), endedAt: new Date(), minutes: 5, completed: true })).rejects.toBeTruthy()
  })
})

describe('a toast with an action', () => {
  function Fire() { const toast = useToast(); return <button onClick={() => toast('Done', { label: 'Mark done', onClick: () => {} })}>fire</button> }
  it('stays long enough for a student who was away to come back to it', async () => {
    vi.useFakeTimers()
    render(<ToastProvider><Fire /></ToastProvider>)
    act(() => { screen.getByText('fire').click() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(screen.queryByText('Mark done')).not.toBeNull()
  })
})
