import type { PostgrestError } from '@supabase/supabase-js'

export function must<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

export function check(res: { error: PostgrestError | null }): void {
  if (res.error) throw res.error
}
