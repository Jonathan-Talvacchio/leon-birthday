/* ============================================================
   Sfx - every sound is generated with WebAudio, no audio files.
   Named Sfx (not Audio) so it cannot clash with window.Audio.
   ============================================================ */

var Sfx = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;
  var melodyUntil = 0;
  var VOLUME = 0.3;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    return ctx;
  }

  /* Android Chrome only starts audio from inside a user gesture. */
  function unlock() {
    var c = ensure();
    if (c && c.state === "suspended") c.resume();
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : VOLUME;
  }

  function isMuted() { return muted; }

  function ready() {
    if (muted) return null;
    return ensure();
  }

  /* A single note / sweep. */
  function beep(o) {
    var c = ready();
    if (!c) return;
    var t0 = c.currentTime + (o.at || 0);
    var dur = o.dur || 0.1;
    var vol = o.vol == null ? 0.25 : o.vol;

    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.from, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* Filtered white noise - used for pops and crashes. */
  function noise(dur, vol, freq, q) {
    var c = ready();
    if (!c) return;
    if (!noiseBuf) {
      var len = Math.floor(c.sampleRate * 0.5);
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = c.currentTime;
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    var bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq || 1200;
    bp.Q.value = q || 1;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---------------- game / party sounds ---------------- */

  function flap() {
    beep({ from: 360, to: 720, dur: 0.09, type: "square", vol: 0.16 });
  }

  function pop() {
    noise(0.09, 0.35, 1500, 0.8);
    beep({ from: 900, to: 180, dur: 0.13, type: "sine", vol: 0.22 });
  }

  function score() {
    beep({ from: 880, dur: 0.08, type: "triangle", vol: 0.2 });
    beep({ from: 1320, dur: 0.12, type: "triangle", vol: 0.2, at: 0.08 });
  }

  function crash() {
    beep({ from: 340, to: 60, dur: 0.45, type: "sawtooth", vol: 0.24 });
    noise(0.3, 0.25, 450, 0.6);
  }

  function cheer() {
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      beep({ from: notes[i], dur: 0.16, type: "triangle", vol: 0.22, at: i * 0.09 });
    }
  }

  /* ---------------- Happy Birthday ---------------- */

  var N = {
    G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25,
    D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99
  };

  /* [note, beats] - the traditional melody. */
  var MELODY = [
    ["G4", .5], ["G4", .5], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
    ["G4", .5], ["G4", .5], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
    ["G4", .5], ["G4", .5], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 1.5],
    ["F5", .5], ["F5", .5], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 2.5]
  ];

  function happyBirthday() {
    var c = ready();
    if (!c) return;
    if (c.currentTime < melodyUntil) return;   // already playing

    var beat = 0.4;
    var t = 0.05;
    for (var i = 0; i < MELODY.length; i++) {
      var freq = N[MELODY[i][0]];
      var len = MELODY[i][1] * beat;
      beep({ from: freq, dur: len * 0.88, type: "triangle", vol: 0.24, at: t });
      beep({ from: freq / 2, dur: len * 0.88, type: "sine", vol: 0.1, at: t });
      t += len;
    }
    melodyUntil = c.currentTime + t;
  }

  return {
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    flap: flap,
    pop: pop,
    score: score,
    crash: crash,
    cheer: cheer,
    happyBirthday: happyBirthday
  };
})();
