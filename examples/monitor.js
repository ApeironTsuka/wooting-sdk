const { Keyboard } = require('../keyboard'),
      { Toolkit } = require('../toolkit'),
      fs = require('fs'),
      cp = require('child_process'),
      sensors = require('sensors.js'),
      smi = require('node-nvidia-smi'),
      cpuStat = require('cpu-stat');
const cmap = [
  [ 0, 0, 255 ], // blue
  [ 0, 255, 255 ], // cyan
  [ 255, 255, 0 ], // yellow
  [ 255, 127, 0 ], // orange
  [ 255, 0, 0 ] // red
];
let kb = Keyboard.get(), xss;
function sensorsPromise() { return new Promise((res, rej) => { sensors.sensors((data, err) => { if (err) { rej(err); return; } res(data); }); }); }
function smiPromise() { return new Promise((res, rej) => { smi((err, data) => { if (err) { rej(err); return; } res(data); }); }); }
function cpuStatPromise(core) {
  return new Promise((res, rej) => {
    let o = { sampleMs: 200 };
    if ((core !== undefined) && (core != -1)) { o.coreIndex = core; }
    cpuStat.usagePercent(o, (err, percent, sec) => {
      if (err) { rej(err); return; }
      res(percent);
    });
  });
}
function blend(a,b,x) { if (a == b) { return a; } return Math.floor((a * x) + (b * (1 - x))); }
function tempToColor(t) {
  let out = [], x = (t % 20) / 20, c1, c2;
  if (t >= 100) { c1 = c2 = 4; }
  else if (t < 20) { c1 = c2 = 0; }
  else { c2 = Math.floor(t / 20); c1 = c2-1; }
  if (c1 == c2) { out = cmap[c1]; }
  else { for (let i = 0; i < 3; i++) { out[i] = blend(cmap[c2][i], cmap[c1][i], x); } }
  return out;
}
function printNum(n, row) {
  let r, g, b, o = row == 4 && kb.deviceConfig.isANSI ? 2 : 1;
  b = Math.floor(n / 10); n -= b * 10;
  g = Math.floor(n / 5); n -= g * 5;
  r = n;
  for (let i = o; i < b + o; i++) { leds.setLoc(row, i, 0, 0, 255); } o += b;
  for (let i = o; i < g + o; i++) { leds.setLoc(row, i, 0, 255, 0); } o += g;
  for (let i = o; i < r + o; i++) { leds.setLoc(row, i, 255, 0, 0); }
}
console.log(`Found Keyboard\nIt's a Wooting ${kb.isTwo?'Two':'One'}\nFirmware: ${kb.getFirmwareVersion()}`);
kb.init();
let leds = kb.leds, tk = new Toolkit();
leds.mode = Keyboard.Modes.Array;
leds.init();
tk.use(Toolkit.Features.All);
tk.enable();
tk.init(kb);
doRGB();
function doRGB() {
  let pause = false, pause2 = false, mp = [];
  console.log('Begin watching CPU/GPU load/temps and clock..');
  setInterval(() => {
    if (pause) { return; }
    let keys = [];
    sensorsPromise()
    .then((data) => {
      let d = data['coretemp-isa-0000']['ISA adapter'], exit = false;
      keys.push({ key: 'F1', v: tempToColor(d['Package id 0'].value) });
      for (let i = 0; i < 11; i++) {
        if (!d[`Core ${i}`]) { break; }
        keys.push({ key: `F${i+2}`, v: tempToColor(d[`Core ${i}`].value*1.2) });
      }
    })
    .then(smiPromise)
    .then((data) => {
      keys.push({ key: 'Escape', v: tempToColor(parseInt(data.nvidia_smi_log.gpu.temperature.gpu_temp)) });
      keys.push({ key: 'Backspace', v: tempToColor(parseInt(data.nvidia_smi_log.gpu.utilization.gpu_util)) });
    })
    .then(() => {
      let arr = [];
      for (let i = -1, l = Math.max(cpuStat.totalCores(), 12); i < l; i++) { arr.push(cpuStatPromise(i)); }
      return Promise.all(arr);
    })
    .then((load) => {
      for (let i = 0, l = load.length; i < l; i++) {
        switch (i) {
          case  0: keys.push({ key: 'Tilde', v: tempToColor(load[i]) }); break;
          case 10: keys.push({ key: 'Number0', v: tempToColor(load[i]) }); break;
          case 11: keys.push({ key: 'Underscore', v: tempToColor(load[i]) }); break;
          case 12: keys.push({ key: 'Plus', v: tempToColor(load[i]) }); break;
          default: keys.push({ key: `Number${i}`, v: tempToColor(load[i]) }); break;
        }
      }
    })
    .then(() => {
      let { LEDs } = Keyboard, key;
      for (let i = 0, l = keys.length; i < l; i++) { key = keys[i]; leds.setKey(LEDs[key.key], ...key.v); }
      let dt = new Date();
      for (let y = 2; y < 5; y++) { for (let x = 1; x < 11; x++) { leds.setLoc(y, x, 50, 50, 50); } }
      leds.setLoc(4, 11, 50, 50, 50);
      printNum(dt.getHours(), 2);
      printNum(dt.getMinutes(), 3);
      printNum(dt.getSeconds(), 4);
      leds.updateKeyboard();
    })
    .catch((err) => { console.log(err.stack); });
  }, 200)
  let sleepBrightness, sleepDir = -3, tmr;
  let beginSleeping = () => {
    if ((!pause2) && (sleepBrightness >= leds.profile.brightness)) {
      kb.leds.setBrightness(leds.profile.brightness);
      if (leds.mode != Keyboard.Modes.Profile) { leds.enableSdk(); }
      pause = false;
      return;
    }
    sleepBrightness += sleepDir;
    kb.leds.setBrightness(sleepBrightness);
    if (sleepBrightness <= 10) { sleepDir = -sleepDir; }
    else if (sleepBrightness >= leds.profile.brightness) { sleepDir = -sleepDir; }
    setTimeout(beginSleeping, 100);
  };
  xss = cp.spawn('xscreensaver-command', [ '--watch' ]);
  xss.stdout.on('data', (d) => {
    let words = d.toString().split(/ /);
    switch (words[0]) {
      case 'BLANK':
        tmr = setTimeout(() => {
          console.log('Screensaver kicked in, entering "sleep" mode..');
          setTimeout(() => {
            if (leds.mode == Keyboard.Modes.Profile) {
              leds.setColormap(leds.profile.map);
              leds.updateKeyboard();
            } else { leds.enableSdk(false); }
          }, 400);
          sleepBrightness = leds.profile.brightness;
          pause = pause2 = true;
          beginSleeping();
          tmr = null;
        }, 5000);
        break;
      case 'UNBLANK':
        if (tmr) { clearTimeout(tmr); break; }
        console.log('Screensaver ended, waking from "sleep"..');
        pause2 = false;
        break;
      default: break;
    }
  });
}
process.on('SIGINT', () => process.exit());
process.on('exit', () => { if (xss) { xss.kill(); } });

