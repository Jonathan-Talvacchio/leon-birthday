/* ============================================================
   Confetti - one full screen overlay canvas.
   Confetti.rain(true/false)  ambient falling confetti
   Confetti.burst(x, y, n)    a burst at a screen position
   ============================================================ */

var Confetti = (function () {
  var cv, ctx;
  var w = 0, h = 0, dpr = 1;
  var parts = [];
  var raining = false;
  var running = false;
  var last = 0;
  var spawnAcc = 0;

  var MAX = 170;
  var COLORS = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff", "#ff9f1c", "#f72585", "#ffffff"];

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
  }

  function resize() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth || window.innerWidth;
    h = cv.clientHeight || window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function make(x, y, vx, vy) {
    return {
      x: x, y: y, vx: vx, vy: vy,
      size: 5 + Math.random() * 7,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 9,
      wob: Math.random() * Math.PI * 2,
      shape: Math.random() < 0.35 ? "circle" : (Math.random() < 0.5 ? "ribbon" : "rect"),
      life: 0
    };
  }

  function add(p) {
    if (parts.length >= MAX) parts.shift();
    parts.push(p);
  }

  function burst(x, y, n) {
    n = n || 28;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 120 + Math.random() * 330;
      add(make(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 90));
    }
    start();
  }

  function rain(on) {
    raining = !!on;
    if (raining) start();
  }

  function clear() {
    parts.length = 0;
    if (ctx) ctx.clearRect(0, 0, w, h);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (raining) {
      spawnAcc += dt;
      while (spawnAcc > 0.09) {
        spawnAcc -= 0.09;
        add(make(Math.random() * w, -20, (Math.random() - 0.5) * 60, 70 + Math.random() * 110));
      }
    }

    ctx.clearRect(0, 0, w, h);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      p.vy += 620 * dt;                       // gravity
      p.vx *= (1 - 1.1 * dt);                 // air drag
      p.vy *= (1 - 0.35 * dt);
      p.wob += dt * 6;
      p.x += (p.vx + Math.sin(p.wob) * 34) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      if (p.y > h + 40 || p.x < -60 || p.x > w + 60) {
        parts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "ribbon") {
        ctx.fillRect(-p.size * 0.22, -p.size * 0.9, p.size * 0.44, p.size * 1.8);
      } else {
        ctx.fillRect(-p.size * 0.5, -p.size * 0.35, p.size, p.size * 0.7);
      }
      ctx.restore();
    }

    if (parts.length === 0 && !raining) {
      running = false;
      ctx.clearRect(0, 0, w, h);
      return;
    }
    requestAnimationFrame(frame);
  }

  return { init: init, burst: burst, rain: rain, clear: clear, resize: resize };
})();
