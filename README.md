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
| **Party** | Confetti rains down and balloons float up. Tap a balloon to pop it. |
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

**After you change anything**, bump `CACHE_VERSION` in `sw.js` (`birthday-v1` →
`birthday-v2`) and push. That tells tablets that already opened the app to pull
down the new version instead of the cached one.

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
```

## Running it locally

Double-clicking `index.html` works for a quick look. To exercise it exactly as the
tablet will (including offline caching and saved scores), serve the folder:

```bash
python -m http.server 8000
# then open http://localhost:8000
```
