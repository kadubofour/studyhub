import { localStore, useLocalStore } from '@/lib/ui/localStore'

/** The task the student said they are working on: kept with the student's id, so another student on the same device does not inherit it */
export interface FocusTask { uid: string; id: string; title: string; course_id: string | null }

const parse = (v: unknown): FocusTask | null => {
  const o = v as Partial<FocusTask> | null
  if (!o || typeof o.uid !== 'string' || typeof o.id !== 'string' || typeof o.title !== 'string') return null
  return { uid: o.uid, id: o.id, title: o.title.slice(0, 300), course_id: typeof o.course_id === 'string' ? o.course_id : null }
}

export const focusTaskStore = localStore<FocusTask | null>('studyhub.focus.task', null, parse)
export const setFocusTask = (t: FocusTask | null) => focusTaskStore.set(t)
/** The current task for this student, or null */
export const useFocusTask = (uid: string): FocusTask | null => {
  const t = useLocalStore(focusTaskStore)
  return t && t.uid === uid ? t : null
}
