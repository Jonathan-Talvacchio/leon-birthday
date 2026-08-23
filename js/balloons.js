/* ============================================================
   Balloons - drifting up the home screen, tap one to pop it.
   They live in a layer *behind* the screens so the buttons
   always win a tap, and empty space always hits a balloon.
   ============================================================ */

var Balloons = (function () {
  var layer = null;
  var timer = null;
  var MAX = 8;

  /* [body, highlight/shadow] */
  var COLORS = [
    ["#ff5d8f", "#ff9dbb"],
    ["#ffc93c", "#ffe08a"],
    ["#4cc9f0", "#a5e6fa"],
    ["#a06bff", "#c9aaff"],
    ["#35c98b", "#8ae5c0"],
    ["#ff8a3d", "#ffbe8a"]
  ];

  function svg(body, light) {
    return '' +
      '<svg viewBox="0 0 100 170" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M50 108 C50 130 44 140 50 168" stroke="#ffffff" stroke-opacity=".85" ' +
              'stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="50" cy="55" rx="42" ry="52" fill="' + body + '"/>' +
        '<ellipse cx="36" cy="36" rx="12" ry="17" fill="' + light + '" opacity=".85"/>' +
        '<ellipse cx="50" cy="88" rx="26" ry="18" fill="#000" opacity=".07"/>' +
        '<path d="M44 104 L56 104 L50 116 Z" fill="' + body + '"/>' +
      '</svg>';
  }

  /* Pixel balloons when the art has arrived, drawn ones until then. */
  function art() {
    var srcs = [];
    for (var i = 0; i < 3; i++) {
      var s = Sprites.src("balloon" + i);
      if (s) srcs.push(s);
    }
    return srcs;
  }

  function make(immediate) {
    if (!layer || layer.children.length >= MAX) return;

    var c = COLORS[(Math.random() * COLORS.length) | 0];
    var pixel = art();
    var el = document.createElement("div");
    el.className = "balloon";
    el.style.left = (3 + Math.random() * 80) + "%";
    el.style.width = (13 + Math.random() * 7) + "vmin";

    var dur = 14 + Math.random() * 9;
    el.style.animationDuration = dur + "s";
    /* A negative delay starts it part way up, so the screen is never empty. */
    el.style.animationDelay = (immediate ? -(Math.random() * dur * 0.7) : 0) + "s";

    var sway = document.createElement("div");
    sway.className = "sway";
    sway.style.animationDuration = (2.8 + Math.random() * 1.8) + "s";
    if (pixel.length) {
      var im = document.createElement("img");
      im.src = pixel[(Math.random() * pixel.length) | 0];
      im.alt = "";
      im.className = "pixel";
      sway.appendChild(im);
    } else {
      sway.innerHTML = svg(c[0], c[1]);
    }

    el.appendChild(sway);
    el.addEventListener("animationend", function (e) {
      if (e.animationName === "floatUp" && el.parentNode) el.parentNode.removeChild(el);
    });
    layer.appendChild(el);
  }

  function popAt(el) {
    if (!el || el.classList.contains("popped")) return;
    el.classList.add("popped");
    var r = el.getBoundingClientRect();
    Confetti.burst(r.left + r.width / 2, r.top + r.height * 0.35, 26);
    Sfx.pop();
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      make(false);
    }, 200);
  }

  function onDown(e) {
    var el = e.target.closest ? e.target.closest(".balloon") : null;
    if (el) {
      e.preventDefault();
      popAt(el);
    }
  }

  function init(el) {
    layer = el;
    layer.addEventListener("pointerdown", onDown);
  }

  function start() {
    if (!layer) return;
    layer.hidden = false;
    if (timer) return;
    for (var i = 0; i < 5; i++) make(true);
    timer = setInterval(function () { make(false); }, 2400);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (layer) {
      layer.hidden = true;
      layer.innerHTML = "";
    }
  }

  return { init: init, start: start, stop: stop };
})();
