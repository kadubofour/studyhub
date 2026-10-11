// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

let exportFails = false
const exportMyData = vi.fn(async (..._a: unknown[]) => { if (exportFails) throw new Error('Could not read your notes.'); return { app: 'Studyhub', exported_at: '2026-10-11T10:00:00.000Z', data: { notes: [{ id: 'n1' }] } } })
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/account/export', () => ({ exportMyData: (...a: unknown[]) => exportMyData(...a) }))
const replace = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }))
const fetchMock = vi.fn()
import { DataCard } from '@/components/settings/DataCard'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
let blobs: Blob[]
let clicked: { download: string; href: string }[]
beforeEach(() => {
  exportFails = false; exportMyData.mockClear(); fetchMock.mockReset(); replace.mockClear(); refresh.mockClear()
  blobs = []; clicked = []
  vi.stubGlobal('fetch', fetchMock)
  URL.createObjectURL = (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:x' }
  URL.revokeObjectURL = () => {}
  HTMLAnchorElement.prototype.click = function () { clicked.push({ download: this.download, href: this.href }) }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('DataCard — download', () => {
  it('downloads one JSON file named for the day', async () => {
    render(<DataCard now={() => new Date('2026-10-11T10:00:00Z')} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download my data' })) })
    expect(exportMyData).toHaveBeenCalledTimes(1)
    expect(clicked).toEqual([{ download: 'studyhub-data-2026-10-11.json', href: 'blob:x' }])
    expect(JSON.parse(await blobs[0].text()).data.notes).toEqual([{ id: 'n1' }])
    expect(screen.getByRole('status').textContent).toContain('downloaded')
  })
  it('says what failed and downloads nothing', async () => {
    exportFails = true
    render(<DataCard />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download my data' })) })
    expect(screen.getByRole('alert').textContent).toContain('Could not read your notes.')
    expect(clicked).toEqual([])
  })
  it('says the audio of lectures is not in the file', () => {
    render(<DataCard />)
    expect(screen.getByText(/Lecture audio is not included/)).toBeTruthy()
  })
})

describe('DataCard — delete', () => {
  const openDelete = async () => {
    render(<DataCard />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete my account' })) })
  }
  const typeWord = (v: string) => fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: v } })
  const confirmBtn = () => screen.getByRole('button', { name: 'Delete everything' }) as HTMLButtonElement

  it('explains what goes, and waits for the exact word', async () => {
    await openDelete()
    expect(screen.getByText(/can.t be undone/)).toBeTruthy()
    expect(confirmBtn().disabled).toBe(true)
    typeWord('delete')
    expect(confirmBtn().disabled).toBe(true)
    typeWord('DELETE')
    expect(confirmBtn().disabled).toBe(false)
  })
  it('sends the word, then leaves for the start page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await openDelete()
    typeWord('DELETE')
    await act(async () => { fireEvent.click(confirmBtn()) })
    expect(fetchMock).toHaveBeenCalledWith('/api/account/delete', expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) }))
    expect(replace).toHaveBeenCalledWith('/')
  })
  it('keeps the account and says so when deleting fails', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'delete_failed' }), { status: 502 }))
    await openDelete()
    typeWord('DELETE')
    await act(async () => { fireEvent.click(confirmBtn()) })
    expect(screen.getByRole('alert').textContent).toContain('still active')
    expect(replace).not.toHaveBeenCalled()
  })
  it('says deletion is unavailable when the server cannot do it', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 }))
    await openDelete()
    typeWord('DELETE')
    await act(async () => { fireEvent.click(confirmBtn()) })
    expect(screen.getByRole('alert').textContent).toContain('not available')
  })
  it('does nothing twice when pressed twice', async () => {
    let finish: (r: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise<Response>(r => { finish = r }))
    await openDelete()
    typeWord('DELETE')
    await act(async () => { fireEvent.click(confirmBtn()); fireEvent.click(confirmBtn()) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { finish(new Response('{}', { status: 200 })) })
  })
  it('lets the student back out', async () => {
    await openDelete()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep my account' })) })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
