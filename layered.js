class PreciseTimer {
  constructor(func, delay, ...args) {
    this.delay = delay;
    this.func = func;
    this.args = args;
    this._end = false;
  }
  begin() {
    this.lastTick = (new Date()).getTime();
    this.tmr = setTimeout(() => this.run(), this.delay);
  }
  end() { clearTimeout(this.tmr); this._end = true; }
  run() {
    let t1, t2, d, xx, xx2, { delay } = this;
    this.func(...this.args);
    t1 = (new Date()).getTime();
    d = delay - (t1 - this.lastTick);
    this.lastTick = t1 + d;
    xx = delay + d;
    if (xx < 0) {
      xx = -d / delay;
      xx2 = Math.floor(xx) + 1;
      xx = d + (xx2 * delay);
      this.lastTick += (xx2 * delay);
      t1 = (new Date()).getTime();
      for (let i = 0; i <= xx2; i++) { this.func(...this.args); }
      t2 = (new Date()).getTime();
      t2 -= t1;
      xx -= t2;
    }
    if (!this._end) { this.tmr = setTimeout(() => this.run(), xx); }
  }
}
class Layer {
  constructor() { this._init = false; }
  init(kb) {
    this.kb = kb;
    this.map = new Array((kb.isTwo ? 118 : 96) * 4);
    this.map.fill(-1);
    this._init = true;
    this.enable();
  }
  clear() { this.kb = undefined; delete this.map; this._init = false; }
  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
  tick() { return this.enabled; }
  draw(map) {
    let { map: tmap, kb } = this, sa, da, fa, k;
    let f = (n) => Math.floor(n);
    if (!this._init) { return false; }
    if (!this.enabled) { return true; }
    for (let i = 0, l = kb.isTwo ? 118 : 96; i < l; i++) {
      k = i * 4;
      if (tmap[k + 3] == -1) { continue; }
      sa = tmap[k + 3] / 255; da = map[k + 3] / 255; fa = sa + (da * (1 - sa));
      if (tmap[k] != -1) { map[k] = f(((tmap[k] * sa) + (map[k] * (da * (1 - sa)))) / fa); }
      if (tmap[k + 1] != -1) { map[k + 1] = f(((tmap[k + 1] * sa) + (map[k + 1] * (da * (1 - sa)))) / fa); }
      if (tmap[k + 2] != -1) { map[k + 2] = f(((tmap[k + 2] * sa) + (map[k + 2] * (da * (1 - sa)))) / fa); }
      map[k + 3] = Math.floor(fa * 255);
    }
    return true;
  }

  setLoc(row, col, r, g, b, a = 255) {
    if (!this._init) { return false; }
    return this.setKey(this.kb.leds.getSafeLedIndex(row, col), r, g, b, a);
  }
  setKey(key, r, g, b, a = 255) {
    let { map } = this;
    if (!this._init) { return false; }
    if ((key < 0) || (key >= (this.kb.isTwo ? 118 : 96))) { return false; }
    map[key * 4] = r;
    map[key * 4 + 1] = g;
    map[key * 4 + 2] = b;
    map[key * 4 + 3] = a;
    return true;
  }
  resetLoc(row, col) {
    if (!this._init) { return false; }
    return this.resetKey(this.kb.leds.getSafeLedIndex(row, col));
  }
  resetKey(key) {
    let { map } = this;
    if (!this._init) { return false; }
    if ((key < 0) || (key >= (this.kb.isTwo ? 118 : 96))) { return false; }
    map[key * 4] = map[key * 4 + 1] = map[key * 4 + 2] = map[key * 4 + 3] = -1;
    return true;
  }
  setColormap(map) {
    let { map: tmap } = this;
    if (!this._init) { return false; }
    for (let i = 0, l = map.length; i < l; i++) { tmap[i] = map[i]; }
    return true;
  }
  setColormapNoAlpha(map, alpha = 255) {
    let { map: tmap } = this;
    if (!this._init) { return false; }
    for (let i = 0, l = (this.kb.isTwo ? 118 : 96); i < l; i++) {
      tmap[i * 4] = map[i * 3];
      tmap[i * 4 + 1] = map[i * 3 + 1];
      tmap[i * 4 + 2] = map[i * 3 + 2];
      tmap[i * 4 + 3] = alpha;
    }
    return true;
  }
}

class Renderer {
  constructor(kb) {
    this.kb = kb;
    this.layers = [];
    this.map = new Array((kb.isTwo ? 118 : 96) * 4);
    this.outmap = new Array((kb.isTwo ? 118 : 96) * 3);
    this.map.fill(0);
  }
  init() {
    this.tmr = new PreciseTimer(() => this.run(), 100);
    this.tmr.begin();
  }
  stop() { this.tmr.end(); }
  addLayer(layer, ind = -1) {
    if (ind == -1) { this.layers.push(layer); }
    else { this.layers.splice(ind, 0, layer); }
    layer.init(this.kb);
    return true;
  }
  moveLayer(layer, ind = -1) {
    if (ind == -1) { return false; }
    let { layers } = this, i = layers.indexOf(layer);
    if (i == -1) { return false; }
    if (i == ind) { return true; }
    else { layers.splice(i, 1); layers.splice(ind, 0, layer); }
  }
  remLayer(layer) {
    let { layers } = this, i = layers.indexOf(layer);
    if (i == -1) { return true; }
    layers.splice(i, 1);
    layer.clear();
    return true;
  }

  tick() { for (let i = 0, { layers } = this, l = layers.length; i < l; i++) { layers[i].tick(); } }
  draw() {
    let { map, outmap, kb } = this;
    map.fill(0);
    for (let i = 0, l = (kb.isTwo ? 118 : 96); i < l; i++) { map[i * 4 + 3] = 255; }
    for (let i = 0, { layers } = this, l = layers.length; i < l; i++) { layers[i].draw(map); }
    for (let i = 0, l = (kb.isTwo ? 118 : 96); i < l; i++) {
      outmap[i * 3] = map[i * 4];
      outmap[i * 3 + 1] = map[i * 4 + 1];
      outmap[i * 3 + 2] = map[i * 4 + 2];
    }
  }
  run() {
    this.tick();
    this.draw();
    this.kb.leds.setColormap(this.outmap);
  }
}
module.exports = { Layer, Renderer };
