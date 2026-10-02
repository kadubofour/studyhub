import type { PostgrestError } from '@supabase/supabase-js'

export function must<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

// PostgREST caps each response (1000 rows by default), so read long lists page by page.
// `page` must apply a stable order so pages don't overlap.
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const rows = must(await page(from, from + size - 1))
    out.push(...rows)
    if (rows.length < size) return out
  }
}

export function check(res: { error: PostgrestError | null }): void {
  if (res.error) throw res.error
}
