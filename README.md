# Animated Shorts — "The Tower That Refused to Stand Up"

A 60 s vertical (1080×1920, 30 fps) animated short about the **Leaning Tower of Pisa**, made with the
[claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) skill: flat 2D cartoon characters in a
colourful, ink-outlined 3D world, rendered with three.js inside Remotion. There's no AI video generator involved.

**Story** (see `SCRIPT.md` for the full voice-over and sources): the tower started tipping 5 years into a 200-year
build. A war paused work for almost a century, which accidentally saved it. The builders then bent the upper floors
to hide the lean (it's banana-shaped), and Mussolini's concrete "fix" made it lean further. In 1990 engineers pulled
soil out and swung it back 45 cm, then stopped on purpose, because the lean is the attraction.

## Layout
| Path | What it is |
|---|---|
| `SCRIPT.md` | Facts and sources, plus the voice-over script |
| `src/videos/pisa/story.ts` | The timeline: 15 shots, camera keys, lens blur, tower lean. Everything is anchored to **words** of `words.json` |
| `src/videos/pisa/words.json` | Word timings. Estimated now; replaced from the real voice-over |
| `src/videos/pisa/tower.ts` | The procedural tower: 8 storeys, growing floors, lean, "banana" correction, scaffold |
| `src/videos/pisa/world.ts` | Sky, lawn and foundation pit, era props (1173 site, 1934 concrete mixer, 1990 cables and drill, modern stalls), the mattress |
| `src/videos/pisa/build.ts` | Cathedral, baptistery, city walls, Tuscan town, trees |
| `src/videos/pisa/cast.ts`, `toon.ts` | Characters (builders, soldiers, the 1934 dictator, engineers, tourists, kid) and their drawing |
| `ink.ts`, `lensblur.ts`, `grade.ts`, `shade.ts`, `cardshade.ts`, `lights.ts`, `paint.ts` | The skill's look engine (ink lines, thin-lens DOF, grade, two-tone light, painted textures) |
| `public/pisa/kenney/` | CC0 Kenney models (fantasy-town, food, graveyard, car, furniture and nature kits) |
| `audio/pisa_sound.py` | Original 6/8 tarantella score and synthesized SFX, cut to the word anchors |
| `audio/pisa_mix.py` | Final mix: voice + ducked music + SFX, −14 LUFS, −1 dBTP, optional mux |
| `scripts/` | Stills, contact sheets, full render, word alignment, frame QA |

## Requirements
Node 22, Python 3 with `numpy scipy pillow`, ffmpeg, and Chrome or Chromium (software WebGL works; set `CHROME=` to the binary).

```bash
npm install
npm run studio                                   # Remotion Studio preview
node scripts/stills.mjs out/pisa/x_ 100,900 0.5  # look-check stills
node scripts/render.mjs 1 2                      # full 1080x1920 render (resumable chunks) -> out/pisa/video_1.mp4
node scripts/render.mjs 1.3333 2                 # 2K final 1440x2560
```

## Adding the voice-over
1. Record `voice.wav`, reading `SCRIPT.md` in one steady tone (~3.7 words/s, ~60 s).
2. Get word timings, either way:
   - `python scripts/align_words.py voice.wav` fits the known script to the pauses in the recording, or
   - copy word timestamps from any speech-to-text tool (`[{ "w", "s", "e" }]`) to `src/videos/pisa/words.json`.
3. Re-time picture and sound. Every cut, reaction, camera move and sound effect follows the words:
   ```bash
   npx tsx scripts/anchors.ts && python audio/pisa_sound.py
   node scripts/render.mjs 1.3333 2
   python audio/pisa_mix.py voice.wav --mux out/pisa/video_1.3333.mp4 out/pisa/final.mp4
   python scripts/short_qa.py out/pisa/final.mp4 out/pisa/qa
   ```

## Credits
- Look engine, pipeline and rules: [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT).
- 3D props: [Kenney](https://kenney.nl) (CC0).
- Story, characters, script, score and SFX: original to this project.
