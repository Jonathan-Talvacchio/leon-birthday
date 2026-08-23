/* ============================================================
   Sprites - loads the pixel art and reports what actually arrived.

   Every drawing in the app asks for a sprite first and falls back to
   the hand drawn version if it is missing, so a failed or not yet
   created image never breaks the party.
   ============================================================ */

var Sprites = (function () {
  var imgs = {};
  var ok = {};
  var loaded = false;

  function load(map, onDone) {
    var names = [];
    for (var k in map) if (map.hasOwnProperty(k)) names.push(k);

    var pending = names.length;
    if (!pending) { loaded = true; if (onDone) onDone(); return; }

    names.forEach(function (name) {
      var im = new Image();
      im.onload = function () {
        imgs[name] = im;
        ok[name] = true;
        if (--pending === 0) { loaded = true; if (onDone) onDone(); }
      };
      im.onerror = function () {
        ok[name] = false;
        if (--pending === 0) { loaded = true; if (onDone) onDone(); }
      };
      im.src = map[name];
    });
  }

  /* Generated art comes with transparent padding around the subject.
     Measure the real content box once so drawings can fill the space
     they are given instead of floating inside invisible margins. */
  /* Slide the wax against itself and find the shift where it lines up
     again. Skips the rounded lip at the top and the outline at the very
     bottom, since neither repeats. */
  function findPeriod(d, imW, box) {
    var top = box.wideY + Math.round(box.wideH * 0.10);
    var bot = box.wideY + box.wideH - Math.round(box.wideH * 0.06);
    /* A spiral can turn slowly, so look almost the whole way down and
       just insist on enough overlapping rows to trust the match. */
    var maxP = bot - top - 15;
    if (maxP < 4) return 0;

    var bestP = 0, bestScore = Infinity;
    for (var p = 4; p <= maxP; p++) {
      var diff = 0, n = 0;
      for (var y = top; y + p < bot; y += 2) {
        for (var x = box.x; x < box.x + box.w; x += 2) {
          var i1 = (y * imW + x) * 4;
          var i2 = ((y + p) * imW + x) * 4;
          diff += Math.abs(d[i1] - d[i2]) +
                  Math.abs(d[i1 + 1] - d[i2 + 1]) +
                  Math.abs(d[i1 + 2] - d[i2 + 2]);
          n += 3;
        }
      }
      if (!n) continue;
      var score = diff / n;
      if (score < bestScore) { bestScore = score; bestP = p; }
    }
    /* a real repeat is nearly identical; anything vague is not worth tiling */
    return bestScore < 12 ? bestP : 0;
  }

  var boxes = {};
  function bounds(name) {
    if (boxes[name]) return boxes[name];
    var im = get(name);
    if (!im) return null;

    var box = { x: 0, y: 0, w: im.width, h: im.height };
    try {
      var c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      var g = c.getContext("2d");
      g.drawImage(im, 0, 0);
      var d = g.getImageData(0, 0, im.width, im.height).data;

      var minX = im.width, minY = im.height, maxX = -1, maxY = -1;
      for (var y = 0; y < im.height; y++) {
        for (var x = 0; x < im.width; x++) {
          if (d[(y * im.width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) {
        box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };

        /* Where does the shape stop being narrow? For the candle that is
           the top of the wax, below the thin wick - which is what the
           column should be built from. */
        var wideY = box.y;
        for (var ry = box.y + box.h - 1; ry >= box.y; ry--) {
          var l = -1, r = -1;
          for (var rx = box.x; rx < box.x + box.w; rx++) {
            if (d[(ry * im.width + rx) * 4 + 3] > 8) {
              if (l < 0) l = rx;
              r = rx;
            }
          }
          if (l < 0 || (r - l + 1) < box.w * 0.6) { wideY = ry + 1; break; }
        }
        box.wideY = wideY;
        box.wideH = box.y + box.h - wideY;

        /* How far down does the pattern travel before it repeats? For a
           barber pole stripe that is the height of one full turn, and it
           lets a column of any length be tiled without breaking the
           spiral. 0 means "no clean repeat found, do not tile". */
        box.period = findPeriod(d, im.width, box);
      }
    } catch (e) { /* keep the untrimmed box */ }
    if (box.wideY == null) { box.wideY = box.y; box.wideH = box.h; }
    if (box.period == null) box.period = 0;

    boxes[name] = box;
    return box;
  }

  function get(name) { return ok[name] ? imgs[name] : null; }
  function has(name) { return !!ok[name]; }
  function src(name) { return ok[name] ? imgs[name].src : null; }
  function isLoaded() { return loaded; }

  /* Pixel art must never be smoothed or it turns to mush when scaled. */
  function crisp(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
  }

  return { load: load, get: get, has: has, src: src, bounds: bounds,
           isLoaded: isLoaded, crisp: crisp };
})();
