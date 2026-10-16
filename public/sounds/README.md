# Background sounds

The Focus page offers Rain, Ocean and Lo-fi. Rain and Ocean play their recording from this folder as a seamless loop (the end is blended into the start when it loads). Lo-fi is a shuffled playlist of the `lofi-*.ogg` tracks, each fading into the next (4 seconds), streamed rather than loaded whole.
If a file is missing or cannot be read, the app makes a soft stand-in sound in the browser instead, so the buttons always work.

| File | What | Source | Licence |
|---|---|---|---|
| `lofi-1.ogg` | "Lofi Hip Hop Loop" by omfgdude | https://opengameart.org/content/lofi-hip-hop-loop | CC0 |
| `lofi-2.ogg` | "Lofi again" by omfgdude (0.5 dB quieter) | https://opengameart.org/content/lofi-again | CC0 |
| `lofi-3.ogg` | "Chill lofi inspired" by omfgdude (3.9 dB quieter, re-encoded from the MP3) | https://opengameart.org/content/chill-lofi-inspired | CC0 |
| `rain.ogg` | "Rain and Thunder #4" (BigSoundBank #2719): a steady four-minute stretch (29:10 to 33:10 of the original), without the thunder claps; made a steady 18.8 dB louder (the original is very quiet), nothing else changed | https://bigsoundbank.com/search?q=rain+and+thunder | CC0 |
| `sea.ogg` | "Sea: Waves" #266 by Denis Chardonnet (the file as downloaded) | https://bigsoundbank.com/sea-waves-s0266.html | CC0 |

Rain and Ocean sit at about -27 and -23 LUFS (a measure of loudness), the three Lo-fi tracks at about -20 LUFS each (so they match one another) and played a little lower in the code. All CC0 (public domain): no credit is needed, but it is given here.

How each is played (speed, filter) is set in `lib/focus/ambient.ts`; all three play as recorded.
Keep each file under about 3 MB: they load when a student first picks the sound (Lo-fi loads one track at a time).
To add a Lo-fi track: put an `.ogg` here, set it to about -20 LUFS, and add its path to `PLAYLISTS.lofi` in `lib/focus/ambient.ts`.
