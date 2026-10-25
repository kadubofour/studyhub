// A share link's token: 64 hex characters today; anything outside a plain URL-safe word is not one of ours
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/
export const isShareToken = (t: unknown): t is string => typeof t === 'string' && TOKEN.test(t)
