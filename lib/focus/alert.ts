// What happens when time is up: a chime, a vibration and a notification. Each is optional and none can throw: a browser without one simply skips it.

type AudioCtor = typeof AudioContext
let ctx: AudioContext | null = null
const audioCtor = (): AudioCtor | undefined => (typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext)

/**
 * Browsers only let a page make sound after the student has tapped something, so the Start button calls this: the sound is then ready
 * when the session ends, even minutes later.
 */
export function primeAudio() {
  try {
    const Ctor = audioCtor()
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* no audio */ }
}

/** The page's one audio context (made, and woken if it can be), for the chime and the ambient sounds; null where there is no audio */
export function audioContext(): AudioContext | null {
  primeAudio()
  return ctx
}

/** Three soft notes going up, about a second and a half long */
export function chime(volume = 0.4) {
  try {
    primeAudio()
    if (!ctx) return
    const start = ctx.currentTime + 0.02
    ;[659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx!.createOscillator(), gain = ctx!.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      const t = start + i * 0.28
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t); osc.stop(t + 0.75)
    })
  } catch { /* no audio */ }
}

export function vibrate() {
  try { navigator.vibrate?.([200, 120, 200, 120, 400]) } catch { /* not supported */ }
}

export const notificationsAvailable = () => typeof window !== 'undefined' && 'Notification' in window
export const notificationPermission = (): NotificationPermission | 'unsupported' => (notificationsAvailable() ? Notification.permission : 'unsupported')

/** Asks the browser to allow notifications (it asks the student), and says what the answer was */
export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsAvailable()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try { return await Notification.requestPermission() } catch { return Notification.permission }
}

/** A notification, but only when the student is not looking at the page (when they are, the page itself says it) */
export function notify(title: string, body: string, opts: { tag?: string; onClick?: () => void } = {}) {
  try {
    if (!notificationsAvailable() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
    const n = new Notification(title, { body, tag: opts.tag ?? 'studyhub-focus', icon: '/favicon.ico' })
    n.onclick = () => { window.focus(); opts.onClick?.(); n.close() }
  } catch { /* some phones only allow notifications from a service worker */ }
}
