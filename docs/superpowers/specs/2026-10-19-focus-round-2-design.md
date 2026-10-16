# Focus round 2: design

## Understanding

- **Said:** keep the ambient sound playing across pages and remember it, style its volume slider in the accent colour, a bigger ring on a phone, keyboard shortcuts, a full-screen mode, and keeping the screen awake during a session.
- **Found while exploring:** `public/sounds/` holds only a README. The rain, café and lo-fi files were never shipped, so the sound buttons always said "This sound isn't available." Instead of shipping audio files, the sounds are now made in the browser (Web Audio): filtered noise for rain, a murmur and the odd clink for café, a soft chord loop with crackle for lo-fi. They are synthetic, not recordings, and need no files or licences.
- **Assumed (recommended options):** the sound keeps playing until the student turns it off; screen-awake is on by default and has a switch in Settings; shortcuts work on the Focus page only.

## What changes

| Part | Behaviour |
|---|---|
| Ambient sound | Plays from the app layout, so it carries on when the student leaves the Focus page. The choice and volume are kept on the device. After a reload it resumes at the first tap (a browser will not play sound before one). |
| Lo-fi | A shuffled playlist (never the same track twice in a row), each track fading into the next over 4 seconds, streamed one at a time so a long session does not hear one song on repeat or hold it all in memory. |
| Volume slider | Drawn in the accent colour. |
| Ring on a phone | The ring is up to 86% of the screen width (at most 22rem) and the countdown is larger. Desktop is unchanged. |
| Shortcuts | Space start or pause, R restart, S skip, F full screen. Ignored while typing or on a control that uses those keys, and with Ctrl, Alt or Cmd held. Nothing on the page lists them. |
| Full screen | A button (and F) opens a full-window view with a large countdown, the session dots and the task, Pause, Restart, Skip and Exit. It also asks the browser for real full screen where that is allowed. Escape or leaving browser full screen closes it. A calm animation plays behind the countdown (slow drifting colour, a breathing glow, soft specks rising); it holds still for people who ask their device to reduce motion. |
| Screen awake | While a session runs, the screen is kept on (Screen Wake Lock), re-taken when the student returns to the tab, released when it stops. A switch in Settings, "Keep the screen on during a session", turns it off. Browsers without the feature do nothing. |

## Parts

- `lib/focus/ambientPrefs.ts`: the kept choice (`localStore`). `lib/focus/ambient.ts`: the sound engine (`startAmbient`, `stopAmbient`, `setAmbientVolume`). `components/focus/AmbientPlayer.tsx`: in the app layout; applies the choice to the engine.
- `lib/focus/wakeLock.ts`: `useWakeLock(active)`, used by the focus provider. `FocusPrefs.keepAwake` (default true).
- `lib/focus/shortcuts.ts`: `focusShortcut(event)` decides what a key press means. `components/focus/FocusFullscreen.tsx`: the full-screen view.

## Not in this round

Goal bar and today's sessions list, mode colours, a seconds drum, uploaded sound files.
