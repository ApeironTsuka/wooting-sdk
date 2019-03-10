const { Keyboard } = require('wooting-sdk'),
      { Toolkit, lockLayer } = require('wooting-sdk/toolkit'),
      { Layer, Renderer } = require('wooting-sdk/layered');

class testLayer extends Layer {
  setColor(r, g, b, t) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.t = t;
    this.dr = r >= 0;
    this.dg = g >= 0;
    this.db = b >= 0;
  }
  setAlpha(n) { this.a = n; }
  tick() {
    let { map, r, g, b, a } = this;
    if (this.dr) { r += this.t; }
    if (this.dg) { g += this.t; }
    if (this.db) { b += this.t; }
    for (let i = 0, l = kb.isTwo ? 117 : 96; i < l; i++) {
      map[i * 4] = r;
      map[i * 4 + 1] = g;
      map[i * 4 + 2] = b;
      map[i * 4 + 3] = a;
    }
    if (this.dr) { this.r = (r < 0 ? 255 + r : r) % 255; }
    if (this.dg) { this.g = (g < 0 ? 255 + g : g) % 255; }
    if (this.db) { this.b = (b < 0 ? 255 + b : b) % 255; }
  }
}
class bgLayer extends Layer { tick() { this.setColormapNoAlpha(this.kb.leds.profile.map); } }

let kb = Keyboard.get(), tk = new Toolkit(), leds, renderer = new Renderer(kb);
kb.init();
leds = kb.leds;
leds.mode = Keyboard.Modes.Array;
leds.init();
leds.autoUpd = true;
tk.use(Toolkit.Features.AllLayered);
tk.enable();
tk.init(kb);

let l1 = new testLayer(), l2 = new testLayer(), bg = new bgLayer(), locks = new lockLayer(tk);
renderer.addLayer(bg); renderer.addLayer(l1); renderer.addLayer(l2); renderer.addLayer(locks);
l1.setColor(5, -1, -1, 10); l1.setAlpha(255);
l2.setColor(-1, -1, 5, 5); l2.setAlpha(127);
renderer.init();

process.on('SIGINT', () => process.exit());
process.on('exit', () => renderer.stop());
