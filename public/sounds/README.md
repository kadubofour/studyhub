# Background sounds

The Focus page offers Rain, Ocean and Lo-fi. Each plays its recording from this folder as a seamless loop (the end is blended into the start when it loads).
If a file is missing or cannot be read, the app makes a soft stand-in sound in the browser instead, so the buttons always work.

| File | What | Source | Licence |
|---|---|---|---|
| `lofi.ogg` | "Lofi Hip Hop Loop" by omfgdude | https://opengameart.org/content/lofi-hip-hop-loop | CC0 |
| `rain.ogg` | "Rain and Thunder #4" (BigSoundBank #2719): a steady four-minute stretch (29:10 to 33:10 of the original), without the thunder claps | https://bigsoundbank.com/search?q=rain+and+thunder | CC0 |
| `sea.ogg` | "Sea: Waves" #266 by Denis Chardonnet (loudness evened out) | https://bigsoundbank.com/sea-waves-s0266.html | CC0 |

The three are set to the same loudness. All CC0 (public domain): no credit is needed, but it is given here.

How they are played is set in `lib/focus/ambient.ts`: the ocean is played slower (lower in pitch) and with the brightness taken off.
Keep each file under about 3 MB: they load when a student first picks the sound.
