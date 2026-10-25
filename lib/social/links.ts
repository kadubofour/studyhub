// The links students pass to each other. `origin` is the site's (location.origin in the browser).
export const friendLink = (origin: string, code: string) => `${origin}/add/${code}`
export const inviteLink = (origin: string, token: string) => `${origin}/join/${token}`

/** The group's invite token from what a student pasted: the token itself or a whole /join/<token> link */
export function inviteToken(text: string): string {
  const t = text.trim()
  const m = t.match(/\/join\/([^/?#\s]+)/)
  return m ? m[1] : t
}
