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

  /* how loud each tune sits under the effects */
  var MENU_FIRST = 1.0;    // the first play through, on the party screen
  var MENU_LOOP = 0.55;    // quieter once it starts repeating
  var GAME_LEVEL = 0.5;    // the game tune stays here the whole time

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
    startMusic(p.name, p.first, p.loop);
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

  /* A room full of people clapping: one hissy wash for the crowd plus a
     scatter of individual claps on top, then a little cheer over it. */
  function applause() {
    var c = ready();
    if (!c) return;
    var t0 = c.currentTime;
    var dur = 2.8;

    var wash = c.createBufferSource();
    wash.buffer = getNoise(c);
    wash.loop = true;
    var bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.6;
    var wg = c.createGain();
    wg.gain.setValueAtTime(0.0001, t0);
    wg.gain.exponentialRampToValueAtTime(0.2, t0 + 0.3);
    wg.gain.setValueAtTime(0.2, t0 + 1.4);
    wg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    wash.connect(bp); bp.connect(wg); wg.connect(master);
    wash.start(t0);
    wash.stop(t0 + dur + 0.05);

    for (var i = 0; i < 44; i++) {
      var t = t0 + 0.02 + Math.random() * (dur * 0.82);
      var clap = c.createBufferSource();
      clap.buffer = getNoise(c);
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 900 + Math.random() * 2400;
      f.Q.value = 1.4;
      var g = c.createGain();
      var peak = 0.1 + Math.random() * 0.1;
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06);
      clap.connect(f); f.connect(g); g.connect(master);
      clap.start(t);
      clap.stop(t + 0.14);
    }

    /* a whoop over the top of the clapping */
    var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    for (var n = 0; n < notes.length; n++) {
      voice(c, master, { from: notes[n], dur: 0.18, type: "triangle", vol: 0.16,
                         at: t0 + 0.15 + n * 0.11 });
    }
  }

  /* ---------------- music ---------------- */

  var N = {
    G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25,
    D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99
  };

  /* [note, beats] */
  var MELODIES = {
    /* Happy Birthday To You */
    birthday: {
      beat: 0.4,
      gap: 1.6,
      notes: [
        ["G4", .5], ["G4", .5], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
        ["G4", .5], ["G4", .5], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
        ["G4", .5], ["G4", .5], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 1.5],
        ["F5", .5], ["F5", .5], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 2.5]
      ]
    },
    /* Las Mananitas - a simple arrangement of the traditional waltz */
    mananitas: {
      beat: 0.42,
      gap: 1.4,
      notes: [
        ["G4", .5], ["G4", .5], ["C5", 1], ["C5", .5], ["C5", .5], ["D5", .5], ["E5", 1.5],
        ["E5", .5], ["D5", .5], ["C5", 1], ["D5", .5], ["C5", .5], ["B4", 1.5],
        ["G4", .5], ["G4", .5], ["C5", 1], ["C5", .5], ["C5", .5], ["D5", .5], ["E5", 1.5],
        ["E5", .5], ["D5", .5], ["C5", 1], ["D5", .5], ["B4", .5], ["C5", 2]
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
    return t - startAt;
  }

  /* Plays a tune and keeps looping it. firstLevel lets the very first
     pass be louder than the repeats. Each run gets its own gain node, so
     a tune fading out can never be turned back up by the one replacing
     it. Scheduling happens even while muted, so unmuting drops you into
     the middle of the tune rather than starting it over. */
  function startMusic(name, firstLevel, loopLevel) {
    if (session && session.name === name) return;   // already playing this one
    var c = ensure();
    if (!c) return;
    var tune = MELODIES[name];
    if (!tune) return;
    stopMusic();

    /* Notes scheduled against a suspended context would all pile up and
       fire at once when it resumes, so wait for the first tap instead. */
    if (c.state !== "running") {
      pending = { name: name, first: firstLevel, loop: loopLevel };
      return;
    }

    var gain = c.createGain();
    gain.gain.value = firstLevel;
    gain.connect(master);

    var mine = { name: name, gain: gain, timer: null };
    session = mine;

    function cycle(first) {
      if (session !== mine) return;                 // superseded
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setValueAtTime(first ? firstLevel : loopLevel, c.currentTime);
      var dur = scheduleMelody(c, tune, gain, c.currentTime + 0.06);
      mine.timer = setTimeout(function () { cycle(false); }, (dur + tune.gap) * 1000);
    }
    cycle(true);
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


  function playing() { return session ? session.name : null; }

  function menuMusic() { startMusic("birthday", MENU_FIRST, MENU_LOOP); }
  function gameMusic() { startMusic("mananitas", GAME_LEVEL, GAME_LEVEL); }

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
    menuMusic: menuMusic,
    gameMusic: gameMusic,
    stopMusic: stopMusic,
    playing: playing
  };
})();
