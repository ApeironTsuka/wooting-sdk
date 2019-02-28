const { Keyboard } = require('../keyboard');
let kb = Keyboard.get(), leds, lastProfile;
kb.init(); leds = kb.leds; leds.init();
lastProfile = kb.leds.profile.id;
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
  for (let y = 2; y < 5; y++) { for (let x = 1; x < 11; x++) { leds.setLoc(y,x, 20, 20, 20); } }
  leds.setLoc(4, 11, 20, 20, 20);
  if (kb.deviceConfig.isISO) { leds.resetKey(4, 1); }
  printNum(dt.getHours(), 2);
  printNum(dt.getMinutes(), 3);
  printNum(dt.getSeconds(), 4);
  leds.updateKeyboard();
}, 250);
setInterval(() => {
  let x = kb.leds.getCurrentProfile();
  if (x != lastProfile) {
    kb.leds.profile = kb.leds.loadProfile(x);
    lastProfile = x;
  }
}, 1000);
process.on('SIGINT', () => {
  setTimeout(() => {
    kb.disconnect();
    process.exit();
  }, 400);
});

