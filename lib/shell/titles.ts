import { MORE_PLACES, PLACES } from './nav'

// The name of the page in the browser tab, for a path: "Library · Studyhub". Each section's layout names its own pages the same way;
// this is for the one time the app has to write a tab's title itself (a timer that was running gives the tab back).
export const APP_NAME = 'Studyhub'
export function pageTitle(path: string): string {
  const place = [...PLACES, ...MORE_PLACES].find(p => path === p.href || path.startsWith(`${p.href}/`))
  return place ? `${place.label} · ${APP_NAME}` : APP_NAME
}
