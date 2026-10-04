'use client'
import type { AudioMime, TranscriptLine } from './time'

export type TranscriptChoice = 'live' | 'accurate' | 'none'
/** `duration` is null while the part is still recording; `uploaded` is null until it's in storage */
export type LocalPart = { index: number; start: number; duration: number | null; uploaded: { path: string; bytes: number } | null }
export type LocalSession = {
  id: string; userId: string; title: string; courseId: string | null; mime: AudioMime; ext: string
  startedAt: string; choice: TranscriptChoice; lines: TranscriptLine[]; parts: LocalPart[]
}

// The device's copy of a recording, kept until the lecture is saved, so a closed tab or a dead
// phone doesn't lose it
export interface RecordingStore {
  saveSession(s: LocalSession): Promise<void>
  sessions(): Promise<LocalSession[]>
  addChunk(sessionId: string, part: number, chunk: Blob): Promise<void>
  partBlob(sessionId: string, part: number, type: string): Promise<Blob | null>
  remove(sessionId: string): Promise<void>
}

export function memoryStore(): RecordingStore {
  const sessions = new Map<string, LocalSession>()
  const chunks: { sessionId: string; part: number; chunk: Blob }[] = []
  return {
    async saveSession(s) { sessions.set(s.id, structuredClone(s)) },
    async sessions() { return [...sessions.values()] },
    async addChunk(sessionId, part, chunk) { chunks.push({ sessionId, part, chunk }) },
    async partBlob(sessionId, part, type) {
      const mine = chunks.filter(c => c.sessionId === sessionId && c.part === part).map(c => c.chunk)
      return mine.length ? new Blob(mine, { type }) : null
    },
    async remove(sessionId) {
      sessions.delete(sessionId)
      for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].sessionId === sessionId) chunks.splice(i, 1)
    },
  }
}

const DB = 'studyhub-recordings'
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('sessions', { keyPath: 'id' })
      req.result.createObjectStore('chunks', { autoIncrement: true }).createIndex('byPart', ['sessionId', 'part'])
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function run<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    const req = work(tx)
    tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  }))
}

export function indexedDbStore(): RecordingStore {
  return {
    async saveSession(s) { await run(['sessions'], 'readwrite', tx => tx.objectStore('sessions').put(s)) },
    async sessions() { return (await run<LocalSession[]>(['sessions'], 'readonly', tx => tx.objectStore('sessions').getAll())) ?? [] },
    async addChunk(sessionId, part, chunk) { await run(['chunks'], 'readwrite', tx => tx.objectStore('chunks').add({ sessionId, part, chunk })) },
    async partBlob(sessionId, part, type) {
      const rows = (await run<{ chunk: Blob }[]>(['chunks'], 'readonly', tx => tx.objectStore('chunks').index('byPart').getAll([sessionId, part]))) ?? []
      return rows.length ? new Blob(rows.map(r => r.chunk), { type }) : null
    },
    async remove(sessionId) {
      await run(['sessions', 'chunks'], 'readwrite', tx => {
        tx.objectStore('sessions').delete(sessionId)
        const index = tx.objectStore('chunks').index('byPart')
        const cursor = index.openCursor(IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity]))
        cursor.onsuccess = () => { const c = cursor.result; if (c) { c.delete(); c.continue() } }
      })
    },
  }
}
