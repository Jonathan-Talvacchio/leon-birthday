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
      }
    } catch (e) { /* keep the untrimmed box */ }
    if (box.wideY == null) { box.wideY = box.y; box.wideH = box.h; }

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
