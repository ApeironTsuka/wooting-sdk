const { Keyboard } = require('../keyboard'), { Toolkit } = require('../toolkit');
let kb = Keyboard.get(), tk = new Toolkit(), leds;
kb.init(); leds = kb.leds; leds.init();
tk.init(kb);
tk.use(Toolkit.Features.All);
tk.enable();
function printNum(n, row) {
  let r, g, b, o = row == 4 ? 2 : 1;
  b = Math.floor(n/10); n -= b*10;
  g = Math.floor(n/5); n -= g*5;
  r = n;
  for (let i = o; i < b+o; i++) { leds.setLoc(row, i, 0, 0, 255); } o+=b;
  for (let i = o; i < g+o; i++) { leds.setLoc(row, i, 0, 255, 0); } o+=g;
  for (let i = o; i < r+o; i++) { leds.setLoc(row, i, 255, 0, 0); }
}
setInterval(() => {
  let dt = new Date();
  for (let y = 2; y < 5; y++) { for (let x = 1; x < 11; x++) { leds.setLoc(y,x, 50, 50, 50); } }
  leds.setLoc(4, 11, 50, 50, 50);
  if (kb.deviceConfig.isISO) { leds.resetKey(4, 1); }
  printNum(dt.getHours(), 2);
  printNum(dt.getMinutes(), 3);
  printNum(dt.getSeconds(), 4);
  leds.updateKeyboard();
}, 250);
process.on('SIGINT', () => process.exit());

