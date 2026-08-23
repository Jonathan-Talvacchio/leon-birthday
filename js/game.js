/* ============================================================
   Dragon Flap - a birthday Flappy Bird, tuned gentle for a 7 year old.

   Draws the pixel art from art/ when it is there and falls back to
   hand drawn canvas paths when it is not. The physics runs on a fixed
   timestep so it plays identically on a 60Hz phone and a 120Hz tablet.

   Nothing moves until the first tap - the countdown is only a flourish.

   Want it easier or harder? Change CONFIG below:
     gapStart  bigger  = easier      scroll  smaller = easier
     gravity   smaller = floatier    spacing bigger  = more room
   ============================================================ */

var Game = (function () {

  var CONFIG = {
    worldH:     640,   // design height in "world units"
    worldWMin:  420,   // never show less than this much width
    gravity:    1500,
    flapV:      -440,
    maxFall:     780,
    scroll:      170,  // world units per second
    gapStart:    262,  // opening between the candles
    gapMin:      202,
    gapShrink:     6,  // gap shrinks this much every 5 points
    spacing:     320,  // distance between candle pairs
    candleW:      72,
    dragonXFrac: 0.30,
    dragonR:      22,  // drawn radius
    hitR:         17,  // collision radius - forgiving on purpose
    groundH:      74,
    countdown:   2.4
  };

  var BEST_KEY = "dragonFlapBest";

  var cv, ctx;
  var els = {};
  var cssW = 0, cssH = 0, dpr = 1, scale = 1;
  var W = 0, H = 0;                    // world size
  var skyGrad = null;

  var raf = 0, last = 0, acc = 0;
  var running = false, paused = false;

  var mode = "ready";                  // ready | play | dead
  var t = 0, countdown = 0, deadT = 0;
  var overShown = false;

  var dragon = { y: 0, vy: 0, rot: 0, wing: 0 };
  var obs = [];
  var clouds = [];
  var score = 0, best = 0, shownScore = -1, shake = 0, groundOff = 0;

  /* ---------------- setup ---------------- */

  function init(canvas, elements) {
    cv = canvas;
    ctx = cv.getContext("2d");
    els = elements;
    best = loadBest();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
  }

  function loadBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; }
    catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) {}
  }

  function resize() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = cv.clientWidth || window.innerWidth;
    cssH = cv.clientHeight || window.innerHeight;
    if (!cssW || !cssH) return;

    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);

    /* Height drives the scale, but never squeeze the world narrower
       than worldWMin - that keeps portrait tablets playable. */
    scale = Math.min(cssH / CONFIG.worldH, cssW / CONFIG.worldWMin);
    W = cssW / scale;
    H = cssH / scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    Sprites.crisp(ctx);              // keep pixel art sharp

    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0.00, "#3fa9f5");
    skyGrad.addColorStop(0.45, "#7fd0ff");
    skyGrad.addColorStop(0.78, "#bdeaff");
    skyGrad.addColorStop(1.00, "#ffe6a8");
  }

  function groundY() { return H - CONFIG.groundH; }
  function dragonX() { return Math.max(74, W * CONFIG.dragonXFrac); }

  /* ---------------- lifecycle ---------------- */

  function reset() {
    mode = "ready";
    t = 0;
    countdown = CONFIG.countdown;
    deadT = 0;
    overShown = false;
    score = 0;
    shownScore = -1;
    shake = 0;
    dragon.y = H * 0.42;
    dragon.vy = 0;
    dragon.rot = 0;
    obs.length = 0;
    clouds.length = 0;
    for (var i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * W * 1.4,
        y: 40 + Math.random() * (H * 0.45),
        s: 0.6 + Math.random() * 0.9,
        sp: 8 + Math.random() * 14
      });
    }
    if (els.over) els.over.hidden = true;
    if (els.hudWrap) els.hudWrap.style.opacity = "0";   // hidden behind the countdown
    updateHud();
  }

  function start() {
    reset();
    if (running) return;
    running = true;
    paused = false;
    last = 0;
    acc = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    paused = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resume() {
    if (!running || !paused) return;
    paused = false;
    last = 0;
    acc = 0;
    raf = requestAnimationFrame(loop);
  }

  /* Nothing moves until the first tap, so the countdown running out can
     never drop the dragon on the floor before he has touched the screen. */
  function flap() {
    if (mode === "ready") {
      mode = "play";
      countdown = 0;
      dragon.vy = CONFIG.flapV;
      if (els.hudWrap) els.hudWrap.style.opacity = "1";
      Sfx.flap();
      return;
    }
    if (mode === "play") {
      dragon.vy = CONFIG.flapV;
      Sfx.flap();
    }
  }

  /* ---------------- update ---------------- */

  function gapFor(s) {
    return Math.max(CONFIG.gapMin, CONFIG.gapStart - Math.floor(s / 5) * CONFIG.gapShrink);
  }

  function spawnObstacle() {
    var lastO = obs[obs.length - 1];
    var x = lastO ? lastO.x + CONFIG.spacing : W + 170;
    var gap = gapFor(score);
    var minY = gap / 2 + 72;
    var maxY = groundY() - gap / 2 - 46;
    if (maxY < minY) maxY = minY;
    obs.push({
      x: x,
      gy: minY + Math.random() * (maxY - minY),
      gap: gap,
      scored: false,
      seed: Math.random() * 10
    });
  }

  function circleHitsRect(cx, cy, r, x1, y1, x2, y2) {
    var nx = cx < x1 ? x1 : (cx > x2 ? x2 : cx);
    var ny = cy < y1 ? y1 : (cy > y2 ? y2 : cy);
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function hits() {
    var cx = dragonX(), cy = dragon.y, r = CONFIG.hitR;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      var left = o.x, right = o.x + CONFIG.candleW;
      if (cx + r < left || cx - r > right) continue;
      if (circleHitsRect(cx, cy, r, left, -400, right, o.gy - o.gap / 2)) return true;
      if (circleHitsRect(cx, cy, r, left, o.gy + o.gap / 2, right, H + 400)) return true;
    }
    return false;
  }

  function die() {
    if (mode !== "play") return;
    mode = "dead";
    deadT = 0;
    shake = 0.4;
    Sfx.crash();
  }

  function showOver() {
    overShown = true;
    var isBest = score > best;
    if (isBest) { best = score; saveBest(best); }

    if (els.overTitle) {
      els.overTitle.textContent = isBest && score > 0 ? "NEW BEST! 🏆" : "Nice flying!";
    }
    if (els.finalScore) els.finalScore.textContent = String(score);
    if (els.bestScore) els.bestScore.textContent = String(best);
    if (els.over) els.over.hidden = false;

    if (isBest && score > 0) {
      Confetti.burst(window.innerWidth / 2, window.innerHeight * 0.35, 70);
      Sfx.cheer();
    }
  }

  function updateHud() {
    if (score !== shownScore && els.hud) {
      els.hud.textContent = String(score);
      shownScore = score;
    }
  }

  function update(dt) {
    t += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 1.4);

    for (var c = 0; c < clouds.length; c++) {
      clouds[c].x -= clouds[c].sp * dt;
      if (clouds[c].x < -140) {
        clouds[c].x = W + 60 + Math.random() * 120;
        clouds[c].y = 40 + Math.random() * (H * 0.45);
      }
    }

    if (mode === "ready") {
      if (countdown > 0) countdown = Math.max(0, countdown - dt);
      dragon.y = H * 0.42 + Math.sin(t * 3.4) * 10;
      dragon.rot = Math.sin(t * 3.4) * 0.07;
      dragon.wing += dt * 11;
      return;                        // waits here for the first tap
    }

    /* gravity applies while playing and while tumbling down */
    dragon.vy = Math.min(dragon.vy + CONFIG.gravity * dt, CONFIG.maxFall);
    dragon.y += dragon.vy * dt;

    if (mode === "play") {
      dragon.wing += dt * (dragon.vy < 0 ? 26 : 13);

      if (dragon.y < CONFIG.dragonR + 4) {        // ceiling is a bump, not death
        dragon.y = CONFIG.dragonR + 4;
        if (dragon.vy < 0) dragon.vy = 0;
      }

      groundOff = (groundOff + CONFIG.scroll * dt) % 48;

      var i;
      for (i = 0; i < obs.length; i++) obs[i].x -= CONFIG.scroll * dt;
      while (obs.length && obs[0].x + CONFIG.candleW < -30) obs.shift();
      while (!obs.length || obs[obs.length - 1].x < W + CONFIG.spacing) spawnObstacle();

      var dx = dragonX();
      for (i = 0; i < obs.length; i++) {
        if (!obs[i].scored && obs[i].x + CONFIG.candleW < dx) {
          obs[i].scored = true;
          score++;
          Sfx.score();
        }
      }
      updateHud();

      if (dragon.y + CONFIG.hitR > groundY()) {
        dragon.y = groundY() - CONFIG.hitR;
        die();
      } else if (hits()) {
        die();
      }
    } else if (mode === "dead") {
      deadT += dt;
      dragon.wing += dt * 4;
      var floorY = groundY() - CONFIG.dragonR;
      if (dragon.y > floorY) { dragon.y = floorY; dragon.vy = 0; }
      if (!overShown && (deadT > 0.85 || dragon.y >= floorY)) showOver();
    }

    var target = Math.max(-0.45, Math.min(1.05, dragon.vy / 900));
    dragon.rot += (target - dragon.rot) * Math.min(1, dt * 9);
  }

  /* ---------------- drawing ---------------- */

  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawClouds() {
    var sp = Sprites.get("cloud");
    if (sp) {
      for (var k = 0; k < clouds.length; k++) {
        var cc = clouds[k], w = 78 * cc.s;
        ctx.drawImage(sp, cc.x - w / 2, cc.y - w / 4, w, w * 0.5);
      }
      return;
    }
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i], s = c.s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22 * s, 0, Math.PI * 2);
      ctx.arc(c.x + 24 * s, c.y + 6 * s, 17 * s, 0, Math.PI * 2);
      ctx.arc(c.x - 24 * s, c.y + 7 * s, 15 * s, 0, Math.PI * 2);
      ctx.arc(c.x + 6 * s, c.y - 14 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFlame(x, y, dir, seed) {
    var f = 1 + Math.sin(t * 13 + seed) * 0.14;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.2, dir * f * 1.2);

    ctx.strokeStyle = "#4a3b2a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -7);
    ctx.stroke();

    ctx.shadowColor = "rgba(255,170,40,0.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.bezierCurveTo(13, -14, 11, -33, 0, -45);
    ctx.bezierCurveTo(-11, -33, -13, -14, 0, -6);
    ctx.fillStyle = "#ff8a00";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.bezierCurveTo(7, -15, 6, -26, 0, -34);
    ctx.bezierCurveTo(-6, -26, -7, -15, 0, -9);
    ctx.fillStyle = "#ffe27a";
    ctx.fill();
    ctx.restore();
  }

  function drawCandleBody(x, y, w, h, c1, c2) {
    if (h <= 0) return;
    ctx.save();
    roundRectPath(x, y, w, h, 12);
    ctx.clip();
    ctx.fillStyle = c1;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c2;
    var sw = w / 5;
    for (var i = 0; i < 5; i += 2) ctx.fillRect(x + i * sw, y, sw, h);
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(0,0,0,0.18)");
    g.addColorStop(0.34, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0.20)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(92,52,124,0.45)";
    roundRectPath(x, y, w, h, 12);
    ctx.stroke();
  }

  /* One candle, built from the sprite's wax only: a rim at the gap end
     and a single row of that same wax stretched down the shaft, so the
     column is seamless at any length and the flame stays a sensible size.
     tipY is the gap end, endY is the ceiling or the ground. */
  function drawSpriteCandle(sp, box, x, w, tipY, endY, flip, seed) {
    var rimH = w * (box.wideH / box.w) * 0.42;   // just the top lip of the wax
    var dir = flip ? -1 : 1;                      // which way the candle runs

    var shaftTop = flip ? endY : tipY + rimH;
    var shaftBottom = flip ? tipY - rimH : endY;

    if (shaftBottom - shaftTop > 0) {
      var waxRow = box.wideY + Math.round(box.wideH * 0.75);
      ctx.drawImage(sp, box.x, waxRow, box.w, 1,
                    x, shaftTop, w, shaftBottom - shaftTop);
    }

    /* the wax rim, mirrored when the candle hangs from the ceiling */
    var rimSrcH = Math.max(1, Math.round(box.wideH * 0.42));
    var rimTop = flip ? tipY - rimH : tipY;
    ctx.save();
    if (flip) {
      ctx.translate(0, rimTop + rimH / 2);
      ctx.scale(1, -1);
      ctx.translate(0, -(rimTop + rimH / 2));
    }
    ctx.drawImage(sp, box.x, box.wideY, box.w, rimSrcH, x, rimTop, w, rimH);
    ctx.restore();

    /* flame sitting just off the tip, flickering */
    var fl = Sprites.get("flame");
    if (fl) {
      var fb = Sprites.bounds("flame");
      var fh = w * 0.62 * (1 + Math.sin(t * 11 + seed) * 0.09);
      var fw = fh * (fb.w / fb.h);
      var fy = flip ? tipY + fh * 0.1 : tipY - rimH * 0.1 - fh;
      ctx.save();
      if (flip) {
        ctx.translate(0, fy + fh / 2);
        ctx.scale(1, -1);
        ctx.translate(0, -(fy + fh / 2));
      }
      ctx.drawImage(fl, fb.x, fb.y, fb.w, fb.h, x + (w - fw) / 2, fy, fw, fh);
      ctx.restore();
    }
  }

  function drawObstacles() {
    var gY = groundY();
    var sp = Sprites.get("candle");
    var box = sp ? Sprites.bounds("candle") : null;

    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (o.x > W + 40 || o.x + CONFIG.candleW < -40) continue;
      var topEnd = o.gy - o.gap / 2;
      var botStart = o.gy + o.gap / 2;

      if (sp && box) {
        drawSpriteCandle(sp, box, o.x, CONFIG.candleW, topEnd, -30, true, o.seed);
        drawSpriteCandle(sp, box, o.x, CONFIG.candleW, botStart, gY + 6, false, o.seed + 3);
        continue;
      }

      drawCandleBody(o.x, -30, CONFIG.candleW, topEnd + 30, "#ff7fb2", "#fff0f6");
      drawFlame(o.x + CONFIG.candleW / 2, topEnd - 4, -1, o.seed);

      drawCandleBody(o.x, botStart, CONFIG.candleW, gY - botStart + 6, "#66c3f7", "#f2fbff");
      drawFlame(o.x + CONFIG.candleW / 2, botStart + 4, 1, o.seed + 3);
    }
  }

  function drawGround() {
    var gY = groundY();

    var sp = Sprites.get("grass");
    if (sp) {
      var tile = CONFIG.groundH;
      var startX = -(groundOff % tile) - tile;
      for (var gx = startX; gx < W + tile; gx += tile) {
        ctx.drawImage(sp, gx, gY, tile, tile);
        if (H - gY > tile) ctx.drawImage(sp, gx, gY + tile, tile, tile);
      }
      return;
    }

    ctx.fillStyle = "#7ddb92";
    ctx.fillRect(0, gY, W, H - gY);
    ctx.fillStyle = "#66c77c";
    for (var x = -groundOff; x < W; x += 48) ctx.fillRect(x, gY, 24, H - gY);
    ctx.fillStyle = "#46a862";
    ctx.fillRect(0, gY, W, 9);
  }

  function drawDragon() {
    var sp = Sprites.get("dragon");
    if (sp) {
      var box = Sprites.bounds("dragon");
      var h = 62;
      var w = h * (box.w / box.h);
      /* a gentle bob stands in for the wing flap of the drawn version */
      var bob = Math.sin(dragon.wing) * 2.5;
      ctx.save();
      ctx.translate(dragonX(), dragon.y);
      ctx.rotate(dragon.rot);
      ctx.drawImage(sp, box.x, box.y, box.w, box.h, -w / 2, -h / 2 + bob, w, h);
      ctx.restore();
      return;
    }

    var wing = Math.sin(dragon.wing) * 0.8;
    ctx.save();
    ctx.translate(dragonX(), dragon.y);
    ctx.rotate(dragon.rot);

    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#3d8f36";

    /* tail */
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-38, -12);
    ctx.lineTo(-33, 2);
    ctx.lineTo(-40, 12);
    ctx.lineTo(-16, 8);
    ctx.closePath();
    ctx.fillStyle = "#5fbf55";
    ctx.fill();
    ctx.stroke();

    /* far wing */
    drawWing(wing * 0.75 - 0.25, "#4aa544", "#3d8f36");

    /* body */
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 21, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7bd66b";
    ctx.fill();
    ctx.stroke();

    /* belly */
    ctx.beginPath();
    ctx.ellipse(3, 7, 15, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#dcf7b4";
    ctx.fill();

    /* head */
    ctx.beginPath();
    ctx.ellipse(18, -11, 14, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7bd66b";
    ctx.fill();
    ctx.stroke();

    /* snout */
    ctx.beginPath();
    roundRectPath(26, -12, 14, 11, 5);
    ctx.fillStyle = "#8fe07e";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(36, -8.5, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#3d8f36";
    ctx.fill();

    /* smile */
    ctx.beginPath();
    ctx.arc(28, -6, 6, 0.15, 1.15);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#3d8f36";
    ctx.stroke();
    ctx.lineWidth = 3;

    /* eye */
    ctx.beginPath();
    ctx.arc(21, -16, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#3d8f36";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(23, -16.5, 2.9, 0, Math.PI * 2);
    ctx.fillStyle = "#2b2340";
    ctx.fill();

    /* party hat */
    ctx.save();
    ctx.translate(14, -22);
    ctx.rotate(-0.22);
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.lineTo(0, -30);
    ctx.closePath();
    ctx.fillStyle = "#ff5d8f";
    ctx.fill();
    ctx.strokeStyle = "#d63d6f";
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-12, -8, 24, 3.5);
    ctx.fillRect(-12, -17, 24, 3.5);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, -31, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd166";
    ctx.fill();
    ctx.strokeStyle = "#e0ab35";
    ctx.stroke();
    ctx.restore();

    /* near wing */
    ctx.strokeStyle = "#3d8f36";
    drawWing(wing, "#9ae88b", "#3d8f36");

    ctx.restore();
  }

  function drawWing(rot, fill, stroke) {
    ctx.save();
    ctx.translate(-3, -7);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-15, -23, -31, -8);
    ctx.quadraticCurveTo(-17, 9, 0, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }

  function drawCountdown() {
    var label, big, phase;
    if (countdown > 1.8)      { label = "3"; big = true; }
    else if (countdown > 1.2) { label = "2"; big = true; }
    else if (countdown > 0.6) { label = "1"; big = true; }
    else if (countdown > 0)   { label = "GO!"; big = false; }
    else                      { label = "TAP TO FLY!"; big = false; }

    if (countdown > 0) {
      phase = big ? (countdown % 0.6) / 0.6 : Math.max(0, countdown / 0.6);
    } else {
      phase = (Math.sin(t * 4) + 1) / 2;      // gentle pulse while waiting
    }
    var pop = 1 + (1 - phase) * 0.25;

    ctx.save();
    ctx.translate(W / 2, H * 0.30);
    ctx.scale(pop, pop);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 " + (big ? 92 : (label.length > 4 ? 44 : 72)) + "px PartyPixel, sans-serif";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(60,40,110,0.85)";
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 22px PartyPixel, sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(60,40,110,0.8)";
    ctx.strokeText("Tap anywhere to flap!", W / 2, H * 0.30 + 90);
    ctx.fillStyle = "#fff";
    ctx.fillText("Tap anywhere to flap!", W / 2, H * 0.30 + 90);
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);
    }
    ctx.fillStyle = skyGrad || "#7fd0ff";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    drawClouds();
    drawObstacles();
    drawGround();
    drawDragon();
    ctx.restore();

    if (mode === "ready") drawCountdown();
  }

  /* ---------------- main loop ---------------- */

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;           // came back from a locked screen

    acc += dt;
    var step = 1 / 120;
    var guard = 0;
    while (acc >= step && guard++ < 40) {
      update(step);
      acc -= step;
    }
    draw();
  }

  return {
    init: init,
    start: start,
    stop: stop,
    pause: pause,
    resume: resume,
    flap: flap,
    resize: resize,
    getBest: function () { return best; },
    isRunning: function () { return running; },
    /* read only peek at the live state - handy for tuning and testing */
    debug: function () {
      return { mode: mode, score: score, y: dragon.y, vy: dragon.vy,
               x: dragonX(), W: W, H: H, ground: groundY(), obs: obs };
    }
  };
})();
