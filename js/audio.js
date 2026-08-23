/* ============================================================
   Sfx - every sound is generated with WebAudio, no audio files.
   Named Sfx (not Audio) so it cannot clash with window.Audio.

   One shot effects go straight to the master gain. Each run of a tune
   gets its own gain node so it can sit quietly under the effects, and
   so a tune fading out cannot be revived by the one replacing it.
   ============================================================ */

var Sfx = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;
  var VOLUME = 0.3;

  /* how loud the tunes sit under the effects */
  var OPENING_LEVEL = 1.0;  // the very first play, when the app opens
  var MUSIC_LEVEL = 0.5;    // everything after that
  var TRACK_GAP = 10;       // seconds of quiet between songs
  var openingDone = false;

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

  /* Android Chrome only starts audio from inside a user gesture. Any
     tune asked for before that is remembered and started here. */
  function unlock() {
    var c = ensure();
    if (!c) return;
    if (c.state === "suspended") {
      c.resume().then(startPending, function () {});
    } else {
      startPending();
    }
  }

  function startPending() {
    if (!pending) return;
    var p = pending;
    pending = null;
    startMusic(p.key, p.tracks, p.level, p.gap);
  }

  function isUnlocked() {
    return !!ctx && ctx.state === "running";
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : VOLUME;
  }

  function isMuted() { return muted; }

  /* effects are skipped entirely while muted; music keeps running so
     that unmuting drops you back into the middle of the tune */
  function ready() {
    if (muted) return null;
    return ensure();
  }

  function getNoise(c) {
    if (!noiseBuf) {
      var len = Math.floor(c.sampleRate * 0.5);
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /* A single note / sweep, straight to the master gain. */
  function beep(o) {
    var c = ready();
    if (!c) return;
    voice(c, master, o);
  }

  /* The shared note builder: dest lets music route through its own gain. */
  function voice(c, dest, o) {
    var t0 = (o.at != null ? o.at : c.currentTime + 0.001);
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
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* Filtered white noise - used for pops, crashes and clapping. */
  function noise(dur, vol, freq, q) {
    var c = ready();
    if (!c) return;
    var t0 = c.currentTime;
    var src = c.createBufferSource();
    src.buffer = getNoise(c);
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
    var c = ready();
    if (!c) return;
    voice(c, master, { from: 880, dur: 0.08, type: "triangle", vol: 0.2, at: c.currentTime });
    voice(c, master, { from: 1320, dur: 0.12, type: "triangle", vol: 0.2, at: c.currentTime + 0.08 });
  }

  function crash() {
    beep({ from: 340, to: 60, dur: 0.45, type: "sawtooth", vol: 0.24 });
    noise(0.3, 0.25, 450, 0.6);
  }

  function cheer() {
    var c = ready();
    if (!c) return;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      voice(c, master, { from: notes[i], dur: 0.16, type: "triangle", vol: 0.22,
                         at: c.currentTime + i * 0.09 });
    }
  }

  /* Pull the music down for a moment so something can be heard over it,
     then bring it back. */
  function duckMusic(factor, hold, recover) {
    if (!session || !ctx) return;
    var g = session.gain.gain;
    var t = ctx.currentTime;
    var target = Math.max(0.0001, session.level * factor);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + 0.08);
    g.setValueAtTime(target, t + hold);
    g.linearRampToValueAtTime(session.level, t + hold + recover);
  }

  /* A room full of people clapping. No sustained noise bed - that is what
     turns applause into static - just a lot of separate short claps, each
     a filtered noise burst with a sharp attack and a very fast decay,
     swelling and then tailing off. */
  function clapAt(c, t, peak) {
    if (!isFinite(peak) || peak <= 0) return;
    var src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.playbackRate.value = 0.75 + Math.random() * 0.9;   // vary the timbre

    var hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 650 + Math.random() * 450;        // no low rumble
    var bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100 + Math.random() * 1900;
    bp.Q.value = 0.7 + Math.random() * 0.8;

    var g = c.createGain();
    var decay = 0.025 + Math.random() * 0.035;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);  // snap
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.4);                     // random spot in the noise
    src.stop(t + decay + 0.05);
  }

  function applause() {
    var c = ready();
    if (!c) return;
    var t0 = c.currentTime;
    var dur = 2.6;
    var claps = 140;

    duckMusic(0.35, 1.8, 0.9);      // let the clapping through

    for (var i = 0; i < claps; i++) {
      var at = 0.01 + Math.random() * dur;
      var phase = Math.min(1, at / dur);
      /* quick swell, long tail off. The tail is clamped at zero first:
         a negative base here would make Math.pow return NaN, and a NaN
         gain throws when it is scheduled. */
      var tail = Math.max(0, 1 - (phase - 0.12) / 0.88);
      var env = phase < 0.12 ? phase / 0.12 : Math.pow(tail, 1.4);
      clapAt(c, t0 + at, 0.07 + 0.17 * env * (0.55 + Math.random() * 0.7));
    }

    /* a whoop over the top of the clapping */
    var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    for (var n = 0; n < notes.length; n++) {
      voice(c, master, { from: notes[n], dur: 0.18, type: "triangle", vol: 0.22,
                         at: t0 + 0.15 + n * 0.11 });
    }
  }

  /* ---------------- music ---------------- */

  var N = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, "F#4": 369.99,
    G4: 392.00, A4: 440.00, "Bb4": 466.16, B4: 493.88, C5: 523.25,
    D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99
  };

  /* left hand chords, written under the melody */
  var CHORDS = {
    G:   { bass: 196.00, tones: [246.94, 293.66] },          // G  B  D
    D7:  { bass: 146.83, tones: [220.00, 261.63] },          // D  A  C
    C:   { bass: 130.81, tones: [196.00, 261.63] }           // C  G  C
  };

  /* [note, beats] */
  var MELODIES = {
    /* Happy Birthday To You */
    birthday: {
      beat: 0.4,
      notes: [
        ["G4", .5], ["G4", .5], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
        ["G4", .5], ["G4", .5], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
        ["G4", .5], ["G4", .5], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 1.5],
        ["F5", .5], ["F5", .5], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 2.5]
      ]
    },
    /* Las Mananitas, from the piano score: G major, 3/4, a one beat
       pickup then five bars of three, at 90bpm. The chord row is the
       left hand - root on beat one, chord on beats two and three. */
    mananitas: {
      beat: 0.667,
      notes: [
        ["D4", 1],                                          // pickup
        ["G4", 1], ["G4", 1], ["F#4", .5], ["G4", .5],      // bar 1
        ["A4", 1], ["A4", 1], ["G4", 1],                    // bar 2
        ["B4", 1], ["D5", 1], ["C5", 1],                    // bar 3
        ["B4", 1], ["A4", 2],                               // bar 4
        ["G4", 3]                                           // bar 5
      ],
      chords: [
        ["D7", 1],
        ["G", 3],
        ["D7", 3],
        ["G", 2], ["C", 1],
        ["D7", 3],
        ["G", 3]
      ]
    }
  };

  var session = null;
  var pending = null;      // a tune asked for before audio was unlocked

  function scheduleMelody(c, tune, dest, startAt) {
    var t = startAt;
    for (var i = 0; i < tune.notes.length; i++) {
      var freq = N[tune.notes[i][0]];
      var len = tune.notes[i][1] * tune.beat;
      voice(c, dest, { from: freq, dur: len * 0.88, type: "triangle", vol: 0.24, at: t });
      voice(c, dest, { from: freq / 2, dur: len * 0.88, type: "sine", vol: 0.1, at: t });
      t += len;
    }
    var end = t;

    /* oom pah pah underneath, when the tune carries chords */
    if (tune.chords) {
      var ct = startAt;
      for (var k = 0; k < tune.chords.length; k++) {
        var ch = CHORDS[tune.chords[k][0]];
        var bars = tune.chords[k][1];
        if (ch) {
          voice(c, dest, { from: ch.bass, dur: tune.beat * 0.85, type: "sine",
                           vol: 0.14, at: ct });
          for (var b = 1; b < bars; b++) {
            for (var n = 0; n < ch.tones.length; n++) {
              voice(c, dest, { from: ch.tones[n], dur: tune.beat * 0.55,
                               type: "triangle", vol: 0.05, at: ct + b * tune.beat });
            }
          }
        }
        ct += bars * tune.beat;
      }
    }
    return end - startAt;
  }

  /* Plays a list of tunes, looping round them forever with a gap in
     between. Each run owns its gain node, so a tune fading out can never
     be turned back up by the one replacing it. Nothing is scheduled
     until audio is unlocked, otherwise the notes would pile up and all
     fire together when the context resumes. */
  function startMusic(key, tracks, level, gap) {
    if (session && session.key === key) return;     // already running this one
    var c = ensure();
    if (!c) return;
    stopMusic();

    if (c.state !== "running") {
      pending = { key: key, tracks: tracks, level: level, gap: gap };
      return;
    }

    var gain = c.createGain();
    gain.gain.value = level;
    gain.connect(master);

    var mine = { key: key, gain: gain, timer: null, index: 0, track: null, level: level };
    session = mine;

    function cycle() {
      if (session !== mine) return;                 // superseded
      var name = tracks[mine.index % tracks.length];
      mine.index++;
      mine.track = name;
      var tune = MELODIES[name];
      if (!tune) return;

      /* full volume only the very first time the app makes a sound */
      var vol = openingDone ? level : OPENING_LEVEL;
      openingDone = true;
      mine.level = vol;

      var now = c.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(vol, now);
      var dur = scheduleMelody(c, tune, gain, now + 0.06);
      mine.timer = setTimeout(cycle, (dur + gap) * 1000);
    }
    cycle();
  }

  function stopMusic() {
    var mine = session;
    session = null;
    pending = null;
    if (!mine) return;
    if (mine.timer) clearTimeout(mine.timer);
    if (!ctx) return;
    /* fade what is already scheduled instead of cutting it off */
    var t = ctx.currentTime;
    mine.gain.gain.cancelScheduledValues(t);
    mine.gain.gain.setValueAtTime(mine.gain.gain.value, t);
    mine.gain.gain.linearRampToValueAtTime(0.0001, t + 0.3);
    setTimeout(function () { try { mine.gain.disconnect(); } catch (e) {} }, 1500);
  }

  function playing() { return session ? session.track : null; }

  /* One playlist for the whole app. Every screen asks for it and the
     call does nothing if it is already running, so the music carries on
     across the party screen, the card and the game without restarting. */
  function partyMusic() {
    startMusic("party", ["birthday", "mananitas"], MUSIC_LEVEL, TRACK_GAP);
  }

  return {
    unlock: unlock,
    isUnlocked: isUnlocked,
    setMuted: setMuted,
    isMuted: isMuted,
    flap: flap,
    pop: pop,
    score: score,
    crash: crash,
    cheer: cheer,
    applause: applause,
    partyMusic: partyMusic,
    stopMusic: stopMusic,
    playing: playing
  };
})();
