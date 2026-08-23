/* ============================================================
   main.js - wires the three screens together.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var screens = {
    home: $("screen-home"),
    card: $("screen-card"),
    game: $("screen-game")
  };

  var muteBtn = $("mute-btn");
  var muteIcon = $("mute-icon");
  var cake = $("cake");
  var cakeHint = $("cake-hint");
  var current = "home";
  var MUTE_KEY = "partyMuted";

  var CANDLE_COLORS = ["#ff5d8f", "#ffc93c", "#4cc9f0", "#a06bff", "#35c98b", "#ff8a3d", "#ff5d8f"];

  /* ---------------- personalisation ---------------- */

  function applyParty() {
    var p = window.PARTY || {};
    var age = p.age || 7;
    var name = p.name || "";
    var suffix = (age === 1 ? "st" : age === 2 ? "nd" : age === 3 ? "rd" : "th");

    document.title = "Happy " + age + suffix + " Birthday " + name + "!";
    $("age-line").textContent = age + suffix;
    $("name-line").textContent = name + "!";
    $("card-title").textContent = p.cardTitle || ("Happy Birthday, " + name + "!");
    $("card-message").textContent = p.cardMessage || "";

    var wrap = $("candles");
    wrap.innerHTML = "";
    for (var i = 0; i < age; i++) {
      var c = document.createElement("div");
      c.className = "candle";
      c.style.background = CANDLE_COLORS[i % CANDLE_COLORS.length];
      var f = document.createElement("div");
      f.className = "flame";
      f.style.animationDelay = (i * 0.07) + "s";
      c.appendChild(f);
      wrap.appendChild(c);
    }
  }

  /* ---------------- screens ---------------- */

  function showScreen(name) {
    if (current === "game" && name !== "game") Game.stop();

    for (var k in screens) {
      if (screens.hasOwnProperty(k)) screens[k].classList.toggle("is-active", k === name);
    }
    current = name;

    if (name === "home") {
      Balloons.start();
      Confetti.rain(true);
    } else if (name === "card") {
      Balloons.stop();
      Confetti.rain(true);
      relightCake();
    } else if (name === "game") {
      Balloons.stop();
      Confetti.rain(false);
      Confetti.clear();
      Game.resize();
      Game.start();
    }
  }

  /* ---------------- cake ---------------- */

  function relightCake() {
    cake.classList.remove("blown");
    cakeHint.textContent = "Tap the cake to blow out the candles 🎂";
  }

  function tapCake() {
    if (cake.classList.contains("blown")) {
      relightCake();
      return;
    }
    cake.classList.add("blown");
    cakeHint.textContent = "Hooray! Tap again to light them back up ✨";
    var r = cake.getBoundingClientRect();
    Confetti.burst(r.left + r.width / 2, r.top + r.height * 0.2, 60);
    Sfx.happyBirthday();
  }

  /* ---------------- sound ---------------- */

  function loadMuted() {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; }
  }
  function saveMuted(m) {
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch (e) {}
  }
  function paintMute() {
    var m = Sfx.isMuted();
    muteIcon.textContent = m ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", m ? "Turn sound on" : "Turn sound off");
  }
  function toggleMute() {
    var m = !Sfx.isMuted();
    Sfx.setMuted(m);
    saveMuted(m);
    paintMute();
    if (!m) Sfx.score();
  }

  /* ---------------- boot ---------------- */

  function boot() {
    applyParty();

    Confetti.init($("confetti-canvas"));
    Balloons.init($("balloon-layer"));
    Game.init($("game-canvas"), {
      hud: $("hud-score"),
      hudWrap: $("hud"),
      over: $("game-over"),
      overTitle: $("over-title"),
      finalScore: $("final-score"),
      bestScore: $("best-score")
    });

    Sfx.setMuted(loadMuted());
    paintMute();

    /* Android needs a real gesture before any sound can start. */
    window.addEventListener("pointerdown", function once() {
      Sfx.unlock();
      window.removeEventListener("pointerdown", once);
    }, { passive: true });

    $("btn-play").addEventListener("click", function () { showScreen("game"); });
    $("btn-card").addEventListener("click", function () { showScreen("card"); });
    $("btn-card-back").addEventListener("click", function () { showScreen("home"); });
    $("btn-game-back").addEventListener("click", function () { showScreen("home"); });
    $("btn-over-back").addEventListener("click", function () { showScreen("home"); });
    $("btn-retry").addEventListener("click", function () { Game.start(); });
    muteBtn.addEventListener("click", toggleMute);

    cake.addEventListener("pointerdown", function (e) { e.preventDefault(); tapCake(); });
    cake.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapCake(); }
    });

    /* Tapping the canvas flaps. The back button and the game over
       panel sit above it, so they are never swallowed. */
    $("game-canvas").addEventListener("pointerdown", function (e) {
      e.preventDefault();
      Game.flap();
    });

    document.addEventListener("keydown", function (e) {
      if (current !== "game") return;
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); Game.flap(); }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) Game.pause(); else Game.resume();
    });

    showScreen("home");
    window.__partyReady = true;      // tells the recovery guard we made it
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Offline support - only over http(s), never when opened from a file. */
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
