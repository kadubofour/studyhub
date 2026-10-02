import { describe, it, expect, vi } from 'vitest'
import { saveWithRollback } from '@/lib/ui/save'

describe('saveWithRollback', () => {
  it('applies immediately and keeps the change on success', async () => {
    const log: string[] = []
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { log.push('run') }, onFail: () => log.push('fail'), isOnline: () => true,
    })
    expect(log).toEqual(['apply', 'run'])
  })
  it('rolls back and reports failure when online', async () => {
    const log: string[] = []
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { throw new Error('x') }, onFail: () => log.push('fail'), isOnline: () => true,
    })
    expect(log).toEqual(['apply', 'rollback', 'fail'])
  })
  it('keeps the change while offline and retries once on reconnect', async () => {
    const log: string[] = []
    let reconnect: (() => void) | null = null
    let attempts = 0
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { attempts++; if (attempts === 1) throw new Error('offline') },
      onFail: () => log.push('fail'), isOnline: () => false, onReconnect: cb => { reconnect = cb },
    })
    expect(log).toEqual(['apply'])
    reconnect!()
    await vi.waitFor(() => expect(attempts).toBe(2))
    expect(log).toEqual(['apply'])
  })
  it('rolls back if the reconnect retry also fails', async () => {
    const log: string[] = []
    let reconnect: (() => void) | null = null
    await saveWithRollback({
      apply: () => log.push('apply'), rollback: () => log.push('rollback'),
      run: async () => { throw new Error('x') }, onFail: () => log.push('fail'),
      isOnline: () => false, onReconnect: cb => { reconnect = cb },
    })
    reconnect!()
    await vi.waitFor(() => expect(log).toEqual(['apply', 'rollback', 'fail']))
  })
  it('retry re-applies and re-runs', async () => {
    let retry: (() => void) | null = null
    let runs = 0
    await saveWithRollback({
      apply: () => {}, rollback: () => {},
      run: async () => { runs++; if (runs === 1) throw new Error('x') },
      onFail: r => { retry = r }, isOnline: () => true,
    })
    retry!()
    await vi.waitFor(() => expect(runs).toBe(2))
  })
})
