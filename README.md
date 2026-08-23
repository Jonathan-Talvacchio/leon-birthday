# 🎉 Leon's 7th Birthday App

A birthday celebration web app: falling confetti, tappable balloons, a birthday
card with candles to blow out, and **Dragon Flap** — a birthday-themed Flappy Bird.

It is plain HTML, CSS and JavaScript. **No installation, no build step, no
dependencies.** It runs straight from GitHub Pages in any modern browser.

## Open it on the tablet

1. Open Chrome on the Android tablet.
2. Go to **https://jonathan-talvacchio.github.io/leon-birthday/**
3. Optional, and worth doing: tap the **⋮** menu → **Add to Home screen**. It then
   opens fullscreen with its own icon, just like an installed app.

Tap the screen once when it opens — that first tap is what lets the browser start
playing sounds. There is a 🔊 button in the top right to mute everything.

## What is in it

| Screen | What happens |
| --- | --- |
| **Party** | Confetti rains down and pixel balloons float up. Tap a balloon to pop it. |
| **Birthday card** | A message and a cake. Tap the cake to blow out the candles and hear Happy Birthday. Tap again to relight them. |
| **Dragon Flap** | Tap anywhere to flap the dragon between the birthday candles. The best score is saved on the tablet. |

## Changing things

**Name, age and card message** — everything personal lives in one file,
`js/config.js`:

```js
var PARTY = {
  name: "Leon",
  age: 7,
  cardTitle: "Happy Birthday, Leon!",
  cardMessage: "Seven whole years of you! ..."
};
```

The number of candles on the cake follows `age` automatically.

**Game difficulty** — the `CONFIG` block at the top of `js/game.js`:

| Setting | Make it easier |
| --- | --- |
| `gapStart` / `gapMin` | bigger — a wider opening between candles |
| `scroll` | smaller — the candles come at you more slowly |
| `gravity` | smaller — the dragon floats instead of dropping |
| `spacing` | bigger — more room between candle pairs |

**After you change anything**, bump `CACHE_VERSION` in `sw.js` (`birthday-v7` →
`birthday-v8`) and push. Tablets that already have the app pick the new version
up on their very next visit — the page notices the update and refreshes itself
once, so nobody has to open it twice or clear anything.

## Files

```
index.html      the three screens
styles.css      all styling, sky, balloons, cake
icon.svg        home screen icon
manifest.json   makes "Add to Home screen" open it fullscreen
sw.js           small offline cache
js/config.js    ← the only file you need to edit
js/audio.js     all sounds, generated in the browser (no audio files)
js/confetti.js  confetti particles
js/balloons.js  floating, poppable balloons
js/game.js      Dragon Flap
js/main.js      screen switching and wiring
js/sprites.js   loads the pixel art, falls back to drawn art if any is missing
art/            pixel art + the pixel font, all generated with PixelLab
```

## The pixel art

Every sprite in `art/` was generated with [PixelLab](https://pixellab.ai),
along with `partypixel.ttf`, the pixel font the whole app is set in. The
dragon has three drawn wing positions - `dragon.png` (level), `dragon-up.png`
and `dragon-down.png` - cycled level, up, level, down the way the original
Flappy Bird does it. Drop either of the extra two and he simply stops flapping.
Each pose is anchored by the dragon's feet so only the wings move, not the body.

The cake carries seven unlit candles; the flames are laid on top at runtime from
`flame.png`, positioned at each wick, which is what lets them be blown out.

The candle columns are built from `candle.png`: the rounded lip goes at the tip
and one full turn of the spiral is repeated down the shaft, so the stripe runs
unbroken however tall the candle is. The turn length is measured from the image
at load time, so a replacement candle sprite with a different stripe still works.

Sprites are optional by design. `js/sprites.js` loads them in the background and
each drawing asks for its sprite first, falling back to the original hand drawn
version if the file is missing or fails to load. Deleting a PNG changes how the
app looks, never whether it works.

To swap in your own art, drop a replacement PNG in `art/` under the same name
(or point `ART` in `js/config.js` somewhere else) and bump `CACHE_VERSION` in
`sw.js`. Transparent padding is trimmed automatically, so the new sprite does not
have to be framed the same way as the old one.

## Running it locally

Double-clicking `index.html` works for a quick look. To exercise it exactly as the
tablet will (including offline caching and saved scores), serve the folder:

```bash
python -m http.server 8000
# then open http://localhost:8000
```
