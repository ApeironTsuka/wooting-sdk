const { Keyboard } = require('../keyboard');
let kb = Keyboard.get(), leds, analog, lastProfile;
kb.init(); leds = kb.leds; analog = kb.analog; leds.init();
let ships = [], bullets = [], score = 0;
function printNum(n, row) {
  let r, g, b, o = 0;
  y = Math.floor(n / 50); n -= y * 50;
  b = Math.floor(n / 10); n -= b * 10;
  g = Math.floor(n / 5); n -= g * 5;
  r = n;
  for (let i = o; i < y + o; i++) { leds.setLoc(row, i, 255, 255, 0); } o+=y;
  for (let i = o; i < b + o; i++) { leds.setLoc(row, i, 0, 0, 255); } o+=b;
  for (let i = o; i < g + o; i++) { leds.setLoc(row, i, 0, 255, 0); } o+=g;
  for (let i = o; i < r + o; i++) { leds.setLoc(row, i, 255, 0, 0); }
}
class ship {
  constructor() { this.facing = 1; this.x = 1; this.y = 3; this.hp = 3; this.dir = 0; this.cb = undefined; this.f = false; this.fc = 0; }
  color() {
    switch (this.hp) {
      case 3: return [0, 0, 255];
      case 2: return [0, 255, 0];
      case 1: return [255, 0, 0];
      default: return [20, 20, 20];
    }
  }
  up() {
    if (this.y == 4) { this.x--; this.f = false; }
    this.y--;
    if (this.y < 2) { this.y = 2; }
  }
  down() {
    this.y++;
    if (this.y > 4) { this.y = 4; }
    if ((this.y == 4) && (!this.f)) { this.f = true; this.x++; }
  }
  tick() {
    if (this.hp <= 0) { this.cb(); this.del = true; return; }
    if (this.dir != 0) { this.x += this.dir; }
    if (this != ships[0]) {
      this.fc++;
      if (this.fc == 10) {
        let b = new bullet();
        b.x = this.x - 1;
        b.y = this.y;
        b.dir = -0.5;
        b.color = [ 255, 255, 0 ];
        bullets.push(b);
        this.fc = 0;
      }
    }
    if (this.x < 1) { this.del = true; }
  }
  draw() { leds.setLoc(Math.floor(this.y), Math.floor(this.x), ...this.color()); }
}
class bullet {
  constructor(x, y, dir, color) { this.x = x; this.y = y; this.dir = dir; this.color = color; }
  tick() {
    if (this.dir != 0) { this.x += this.dir; }
    let { x, y } = this, f = (n) => Math.floor(n);
    if (x >= 11) { this.del = true; }
    else if (x < 1) { this.del = true; }
    for (let i = 0, l = ships.length; i < l; i++) {
      if ((!ships[i].del) && (f(ships[i].x) == f(x)) && (f(ships[i].y) == f(y))) {
        if ((i != 0) && (!this.player)) { continue; }
        ships[i].hp--;
        this.del = true;
        if (this.cb) { this.cb(); }
      }
    }
  }
  draw() {
    let f = (n) => Math.floor(n), { x, y } = this;
    if ((this != bullets[0]) && (f(bullets[0].x) == f(x)) && (f(bullets[0].y) == f(y))) {
      let c1 = this.color, c2 = bullets[0].color;
      leds.setLoc(f(y), f(x), (c1[0] + c2[0]) & 0xff, (c1[1] + c2[1]) & 0xff, (c1[2] + c2[2]) & 0xff);
    } else { leds.setLoc(f(y), f(x), ...this.color); }
  }
}
let player = new ship(), tmr, n = 0, over = false;
player.cb = () => {
  kb.analog.autoUpd = false;
  over = true;
}
ships.push(player);
setInterval(()=>{}, 10000);
kb.analog.autoUpd = true;
lastProfile = kb.leds.profile.id;
setInterval(() => {
  let x = kb.leds.getCurrentProfile();
  if (x != lastProfile) {
    kb.leds.profile = kb.leds.loadProfile(x);
    lastProfile = x;
  }
}, 1000);
console.log("Controls:\nUp arrow moves up\nDown arrow moves down\nRight arrow fires");
tmr = setInterval(() => {
  if (over) {
    for (let y = 2; y < 5; y++) { for (let x = 1; x < 11; x++) { leds.setLoc(y, x, 0, 0, 0); } }
    leds.setKey(Keyboard.LEDs.G, 0, 255, 0);
    leds.setKey(Keyboard.LEDs.A, 0, 255, 0);
    leds.setKey(Keyboard.LEDs.M, 0, 255, 0);
    leds.setKey(Keyboard.LEDs.O, 255, 0, 0);
    leds.setKey(Keyboard.LEDs.V, 255, 0, 0);
    leds.setKey(Keyboard.LEDs.E, 255, 255, 0);
    leds.setKey(Keyboard.LEDs.R, 255, 0, 0);
    leds.updateKeyboard();
    clearInterval(tmr);
    return;
  }
  for (let y = 1; y < 5; y++) { for (let x = 1; x < 11; x++) { leds.setLoc(y, x, 20, 20, 20); } }
  leds.setLoc(1, 0, 20, 20, 20); leds.setLoc(1, 11, 20, 20, 20); leds.setLoc(1, 12, 20, 20, 20);
  leds.setLoc(4, 11, 20, 20, 20);
  if (kb.deviceConfig.isISO) { leds.resetLoc(4, 1); }
  for (let i = 0, l = bullets.length; i < l; i++) {
    bullets[i].tick();
    if (bullets[i].del) { bullets.splice(i, 1); i--; l--; }
  }
  for (let i = 0, l = ships.length; i < l; i++) {
    ships[i].tick();
    if (ships[i].del) { ships.splice(i, 1); i--; l--; }
  }
  if (analog.readKey(Keyboard.Analog.Up) > 20) { player.up(); }
  if (analog.readKey(Keyboard.Analog.Down) > 20) { player.down(); }
  if (analog.readKey(Keyboard.Analog.Right) > 20) {
    let b = new bullet();
    b.x = player.x + 1;
    b.y = player.y;
    b.dir = 0.5;
    b.color = [ 0, 255, 255 ];
    b.player = true;
    bullets.push(b);
  }
  n++;
  if (n == 20) {
    let s = new ship();
    s.x = 10;
    s.y = 2 + Math.floor(Math.random() * 2);
    s.dir = -0.1;
    s.hp = 1 + Math.floor(Math.random() * 3);
    s.cb = () => { score += 1; };
    ships.push(s);
    n = 0;
  }
  for (let i = 0, l = ships.length; i < l; i++) { ships[i].draw(); }
  for (let i = 0, l = bullets.length; i < l; i++) { bullets[i].draw(); }
  printNum(score, 1);
  leds.updateKeyboard();
}, 100);
process.on('SIGINT', () => {
  kb.analog.autoUpd = false;
  clearInterval(tmr);
  setTimeout(() => {
    kb.disconnect();
    process.exit();
  }, 400);
});

