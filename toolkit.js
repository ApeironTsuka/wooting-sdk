let { Keyboard } = require('./keyboard');
class Toolkit {
  constructor() {
    this.enabled = false;
    this.settings = { locks: false, profile: false };
  }
  init(kb) {
    let lastProfile = undefined,
        lstates = (new Array(8)).fill(0),
        states = (new Array(8)).fill(0),
        akeys = [
          Keyboard.Analog.FnKey,
          Keyboard.Analog.None,
          Keyboard.Analog.None,
          Keyboard.Analog.ScrollLock,
          Keyboard.Analog.CapsLock,
          Keyboard.Analog.NumLock
        ],
        lkeys = [
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
          profile = kb.leds.getCurrentProfile();
          if (profile != lastProfile) {
            kb.leds.profile = kb.leds.loadProfile(profile);
            actuationPoint = kb.getActuationPoint();
            lastProfile = profile;
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
      if (settings.locks) {
        akeys[1] = fnKeys.fnLock.analog;
        akeys[2] = fnKeys.toggleWinkeyDisable.analog;
        lkeys[1] = fnKeys.fnLock.led;
        lkeys[2] = fnKeys.toggleWinkeyDisable.led;
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
              if (n) { leds.setKey(lkeys[0], ...leds.profile.fnLockColor); } else { leds.resetKey(lkeys[0]); }
            }
            if ((states[2] != lstates[2]) && (states[2])) {
              n = locks.win = !locks.win;
              if (n) { leds.setKey(lkeys[2], ...leds.profile.winLockColor); } else { leds.resetKey(lkeys[2]); }
            }
          }
        }
        if (settings.locks) {
          if ((states[3] != lstates[3]) && (states[3]) && (!states[0])) {
            n = locks.scroll = !locks.scroll;
            if (n) { leds.setKey(lkeys[3], ...leds.profile.scrollLockColor); } else { leds.resetKey(lkeys[3]); }
          }
          if ((states[4] != lstates[4]) && (states[4])) {
            n = locks.caps = !locks.caps;
            if (n) { leds.setKey(lkeys[4], ...leds.profile.capsLockColor); } else { leds.resetKey(lkeys[4]); }
          }
          if ((states[5] != lstates[5]) && (states[5])) {
            n = locks.num = !locks.num;
            if (n) { leds.setKey(lkeys[5], ...leds.profile.numLockColor); } else { leds.resetKey(lkeys[5]); }
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
  }
  enable(n) { this.enabled = (n === undefined?true:!!n); }
}
Toolkit.Features = { Locks: 1, Profile: 2, ExitHandler: 4, All: 7 };
module.exports = { Toolkit };
