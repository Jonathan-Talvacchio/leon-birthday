# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A birthday celebration web app for a 7 year old, played on an Android tablet. Plain HTML/CSS/JS with
**no dependencies, no build step and no framework** — it is served directly from GitHub Pages at
https://jonathan-talvacchio.github.io/leon-birthday/ (repo `Jonathan-Talvacchio/leon-birthday`,
public, Pages builds from `main` at root).

Two constraints drive most design decisions:

- **It must run untouched from a static host**, so everything is hand written and loaded with plain
  `<script>` tags. Do not introduce a bundler, npm, ES modules or a package.json. Classic scripts are
  deliberate: the folder also works opened straight from `file://` as a backup.
- **Everything is generated at runtime.** No audio files (WebAudio synthesis) and, apart from `art/`,
  no images (canvas paths and CSS).

## Commands

There is no build, no test suite and no linter. What is actually used:

```bash
python -m http.server 8000        # serve the folder; open http://localhost:8000
node --check js/game.js           # syntax check a file after editing (repeat per file)
```

Deploy is `git push origin main`; GitHub Pages rebuilds. To wait for it and confirm:

```bash
gh api repos/Jonathan-Talvacchio/leon-birthday/pages/builds/latest --jq '.status + " " + .commit'
```

### Verifying changes

The Claude-in-Chrome extension is usually not connected here. The working approach is headless Chrome
driven over the DevTools protocol from a Node script (Node 24 has a global `WebSocket`, so no npm
packages are needed):

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --remote-debugging-port=9222 --user-data-dir=C:/Users/jtee1/AppData/Local/chrome-verify-profile
```

Then `Runtime.evaluate`, `Page.captureScreenshot`, `Emulation.setDeviceMetricsOverride` (tablet sizes),
`Network.emulateNetworkConditions` (offline test) and `Input.dispatchMouseEvent`.

Three things that will waste your time otherwise:

- **Put the profile outside `%TEMP%`** or `caches.open()` fails with "Unexpected internal error" and
  all service worker testing silently breaks.
- **The service worker serves stale files to your test.** Unregister it and clear caches before
  navigating, or you will be testing the previous build and drawing wrong conclusions.
- **Audio needs a real gesture.** `Input.dispatchMouseEvent` counts; `element.click()` does not.
  Nothing musical is scheduled until the context is unlocked.

`Game.debug()` returns live game state (`mode`, `score`, `y`, `vy`, `obs`, world size) and exists for
exactly this — driving the game from a test script and tuning difficulty.

## Architecture

### Module layout

Each `js/*.js` file is an IIFE assigning one global: `PARTY`/`ART`, `Sprites`, `Sfx`, `Confetti`,
`Balloons`, `Game`, plus `main.js` which wires everything. **Load order in `index.html` matters** —
`config.js` and `sprites.js` must come first, `main.js` last.

`main.js` owns screen switching: three `<section class="screen">` elements toggled with `is-active`,
plus per-screen side effects (start/stop balloons, confetti, music, game).

### Sprites and graceful degradation

`js/sprites.js` loads everything in `ART` in the background and **every drawing asks for its sprite
first and falls back to the original hand drawn canvas version if it is missing**. Deleting a PNG
changes how the app looks, never whether it works. Preserve this when adding drawings.

`Sprites.bounds(name)` does more than trim transparent padding — it also computes, in one pass:

- `wideY` / `wideH` — where the shape stops being narrow. For the candle sprite this is the top of
  the wax, below the thin wick, and `game.js` builds candle columns from it.
- `period` — how far the pattern travels before repeating, found by sliding the image against itself.
  This is what lets the barber pole stripe tile down a candle of any length without a seam. Returns 0
  when no clean repeat is found, and the drawing falls back to stretching a single row.

Sprite frames that animate (the dragon's three wing poses) share **one source rectangle**, the union
of their bounds, and are anchored by the dragon's feet — otherwise the body drifts away from its
fixed hitbox as the wings rise.

### Game loop and coordinates

`js/game.js` draws in **world units**, not pixels: `scale = min(cssH/640, cssW/420)`, so gameplay is
identical on any screen and portrait tablets still get a playable field of view. All of `CONFIG` is in
world units.

Physics runs on a **fixed 1/120s timestep with an accumulator**, `dt` clamped to 0.25s, so it plays
the same at 60Hz and 120Hz and never teleports through a candle after the screen sleeps.

Modes are `ready` → `play` → `dead`. Nothing moves in `ready`: the countdown is a flourish and the
first tap starts the game. This is deliberate — gravity used to take over on its own and dropped the
dragon on the floor within 0.8s if he hadn't touched the screen yet.

### Audio

`js/audio.js` synthesizes everything. One shot effects go straight to the master gain; **each run of a
tune gets its own gain node** so a tune fading out cannot be revived by the one replacing it.

Nothing is scheduled while the AudioContext is suspended — notes queued then would all fire at once on
resume — so a tune requested before the first tap is held in `pending` and started by `unlock()`.

One playlist (`Sfx.partyMusic()`) runs across every screen; screens call it and it no ops if already
running, which is what keeps music from restarting on every screen change. Volume: full only on the
very first play after the app opens (`openingDone`), lower forever after.

### Service worker

`sw.js` is cache first and deliberately best effort — each file is cached individually so one failure
cannot sink the install, and a broken CacheStorage just means the app loads from the network.

`main.js` watches for an incoming worker and **reloads once when it activates**, so an update lands on
the first visit rather than the second. It is guarded so a first install and ordinary repeat visits
never reload.

`index.html` also carries an inline recovery guard: if a `<script>` fails to load, or boot never sets
`window.__partyReady`, the page reloads once (flagged in `sessionStorage`) rather than sitting there
half loaded. GitHub Pages returned a transient 503 for one script during testing, which is why.

## When changing things

- **Bump `CACHE_VERSION` in `sw.js` on every change that ships**, or tablets keep serving the old
  cached copy.
- **Adding art needs four edits**: the file in `art/`, an entry in `ART` (`js/config.js`), an entry in
  `FILES` (`sw.js`), and the version bump.
- Anything personal — name, age, card message — lives only in `js/config.js`. The candle count on the
  cake and the title follow `age`.
- Persisted keys: `dragonFlapBest` and `partyMuted` in localStorage, `recoveredOnce` in sessionStorage.
  All reads/writes are wrapped in try/catch because private mode can throw.
- Art is generated with PixelLab (MCP). Sprites frequently come back with an opaque background despite
  the transparency flag; the fix used here is a border flood fill to transparency, which leaves the
  subject's own similar colours alone.
