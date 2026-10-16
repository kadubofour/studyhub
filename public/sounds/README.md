# Background sounds

The Focus page offers Rain, Ocean and Lo-fi. Each plays its recording from this folder as a seamless loop (the end is blended into the start when it loads).
If a file is missing or cannot be read, the app makes a soft stand-in sound in the browser instead, so the buttons always work.

| File | What | Source | Licence |
|---|---|---|---|
| `lofi.ogg` | "Lofi Hip Hop Loop" by omfgdude | https://opengameart.org/content/lofi-hip-hop-loop | CC0 |
| `rain.ogg` | "Rain and Thunder #4" (BigSoundBank #2719): a steady four-minute stretch (29:10 to 33:10 of the original), without the thunder claps; made a steady 18.8 dB louder (the original is very quiet), nothing else changed | https://bigsoundbank.com/search?q=rain+and+thunder | CC0 |
| `sea.ogg` | "Sea: Waves" #266 by Denis Chardonnet (the file as downloaded) | https://bigsoundbank.com/sea-waves-s0266.html | CC0 |

Rain and Ocean sit at about -27 and -23 LUFS (a measure of loudness), Lo-fi at about -20 LUFS and is played a little lower in the code. All CC0 (public domain): no credit is needed, but it is given here.

How each is played (speed, filter) is set in `lib/focus/ambient.ts`; all three play as recorded.
Keep each file under about 3 MB: they load when a student first picks the sound.
