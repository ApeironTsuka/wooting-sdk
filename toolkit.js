const { Keyboard } = require('./keyboard'),
      { Layer } = require('./layered'),
      { EventEmitter } = require('events');
class lockLayer extends Layer {
  constructor(tk) { super(); this.tk = tk; }
  tick() {
    let { settings, lkeys } = this.tk, { kb } = this, { locks } = kb;
    if ((settings.locks) && ((kb.leds.profile.id == 0) || (kb.digitalEnabled))) {
      if (locks.fn) { this.setKey(lkeys[0], ...kb.leds.profile.fnLockColor); }
      else { this.resetKey(lkeys[0]); }
      if (locks.win) { this.setKey(lkeys[2], ...kb.leds.profile.winLockColor); }
      else { this.resetKey(lkeys[2]); }
      if (locks.scroll) { this.setKey(lkeys[3], ...kb.leds.profile.scrollLockColor); }
      else { this.resetKey(lkeys[3]); }
      if (locks.caps) { this.setKey(lkeys[4], ...kb.leds.profile.capsLockColor); }
      else { this.resetKey(lkeys[4]); }
      if (locks.num) { this.setKey(lkeys[5], ...kb.leds.profile.numLockColor); }
      else { this.resetKey(lkeys[5]); }
    }
  }
}
class Toolkit extends EventEmitter {
  constructor() {
    super();
    this.enabled = false;
    this.settings = { locks: false, profile: false, layer: false };
  }
  init(kb) {
    let lastProfile = undefined,
        lstates = (new Array(8)).fill(0),
        states = (new Array(8)).fill(0),
        akeys = this.akeys = [
          Keyboard.Analog.FnKey,
          Keyboard.Analog.None,
          Keyboard.Analog.None,
          Keyboard.Analog.ScrollLock,
          Keyboard.Analog.CapsLock,
          Keyboard.Analog.NumLock
        ],
        lkeys = this.lkeys = [
          Keyboard.LEDs.FnKey,
          Keyboard.LEDs.None,
          Keyboard.LEDs.None,
          Keyboard.LEDs.ScrollLock,
          Keyboard.LEDs.CapsLock,
          Keyboard.LEDs.NumLock
        ], actuationPoint;
    if (!kb) { return false; }
    if (!kb.leds.profile) { return false; }
    this.kb = kb;
    lastProfile = kb.leds.profile.id;
    actuationPoint = kb.actuationPoint;
    let counter = 0;
    setInterval(() => {
      let { kb, settings } = this, profile;
      if (!kb.connected()) { return; }
      if (!this.enabled) { return; }
      if (settings.profile) {
        try {
          profile = kb.getCurrentProfile();
          if (profile != lastProfile) {
            let { leds, locks } = kb;
            leds.profile = leds.loadProfile(profile, !settings.layer);
            actuationPoint = kb.getActuationPoint();
            kb.getDigitalEnabled(profile);
            lastProfile = profile;
            if (!settings.layer) {
              if (!kb.digitalEnabled) {
                leds.resetKey(lkeys[0]);
                leds.resetKey(lkeys[2]);
                leds.resetKey(lkeys[3]);
                leds.resetKey(lkeys[4]);
                leds.resetKey(lkeys[5]);
              } else {
                if (locks.fn) { leds.setKey(lkeys[0], ...leds.profile.fnLockColor); }
                if (locks.win) { leds.setKey(lkeys[2], ...leds.profile.winLockColor); }
                if (locks.scroll) { leds.setKey(lkeys[3], ...leds.profile.scrollLockColor); }
                if (locks.caps) { leds.setKey(lkeys[4], ...leds.profile.capsLockColor); }
                if (locks.num) { leds.setKey(lkeys[5], ...leds.profile.numLockColor); }
              }
            }
            this.emit('profileChanged');
          }
        } catch (e) { /* do nothing as it is 99% likely to be getCurrentProfile throwing it */ }
      }
    }, 200);
    setInterval(() => {
      let { kb, settings } = this,
          { leds, fnKeys, analog, locks } = kb,
          { None } = Keyboard.Analog, n;
      if (!kb.connected()) { return; }
      if (!this.enabled) { return; }
      let setKey = (k, c) => { if (!settings.layer) { leds.setKey(k, ...c); } },
          resetKey = (k) => { if (!settings.layer) { leds.resetKey(k); } };
      akeys[1] = fnKeys.fnLock.analog;
      akeys[2] = fnKeys.toggleWinkeyDisable.analog;
      lkeys[1] = fnKeys.fnLock.led;
      lkeys[2] = fnKeys.toggleWinkeyDisable.led;
      if ((settings.locks) && ((kb.leds.profile.id == 0) || (kb.digitalEnabled))) {
        for (let i = 0, l = akeys.length; i < l; i++) {
          lstates[i] = states[i];
          if (akeys[i] == None) { states[i] = false; continue; }
          n = analog.readKey(akeys[i]);
          states[i] = n >= actuationPoint;
        }
        if ((states[0]) || (locks.fn)) {
          if (settings.locks) {
            if ((states[1] != lstates[1]) && (states[1]) && (states[0])) {
              n = locks.fn = !locks.fn;
              if (n) { setKey(lkeys[0], leds.profile.fnLockColor); } else { resetKey(lkeys[0]); }
            }
            if ((states[2] != lstates[2]) && (states[2])) {
              n = locks.win = !locks.win;
              if (n) { setKey(lkeys[2], leds.profile.winLockColor); } else { resetKey(lkeys[2]); }
            }
          }
        }
        if (settings.locks) {
          if ((states[3] != lstates[3]) && (states[3]) && (!states[0])) {
            n = locks.scroll = !locks.scroll;
            if (n) { setKey(lkeys[3], leds.profile.scrollLockColor); } else { resetKey(lkeys[3]); }
          }
          if ((states[4] != lstates[4]) && (states[4])) {
            n = locks.caps = !locks.caps;
            if (n) { setKey(lkeys[4], leds.profile.capsLockColor); } else { resetKey(lkeys[4]); }
          }
          if ((states[5] != lstates[5]) && (states[5])) {
            n = locks.num = !locks.num;
            if (n) { setKey(lkeys[5], leds.profile.numLockColor); } else { resetKey(lkeys[5]); }
          }
        }
      }
    }, 50);
    if (this.settings.exit) { process.on('exit', () => kb.disconnect()); }
    return true;
  }
  use(n) {
    let sets = Toolkit.Features;
    this.settings.locks = !!(n & sets.Locks);
    this.settings.profile = !!(n & sets.Profile);
    this.settings.exit = !!(n & sets.ExitHandler);
    this.settings.layer = !!(n & sets.Layer);
  }
  enable(n) { this.enabled = (n === undefined?true:!!n); }
}
Toolkit.Features = { Locks: 1, Profile: 2, ExitHandler: 4, Layer: 8, All: 7, AllLayered: 15 };
module.exports = { Toolkit, lockLayer };
