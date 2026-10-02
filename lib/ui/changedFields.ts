// The subset of `form` that differs from `initial` (shallow), for saving only what the user edited.
export function changedFields<T extends object>(initial: T, form: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(form) as (keyof T)[]) {
    if (form[k] !== initial[k]) out[k] = form[k]
  }
  return out
}
