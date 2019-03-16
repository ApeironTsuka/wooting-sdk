const Keys = require('./leds.js');

const rgbLedIndex = [
  [ 0, Keys.None, 11, 12, 23, 24, 36, 47, 85, 84, 49, 48, 59, 61, 73, 81, 80, 113, 114, 115, 116 ],
  [ 2, 1, 14, 13, 26, 25, 35, 38, 37, 87, 86, 95, 51, 63, 75, 72, 74, 96, 97, 98, 99 ],
  [ 3, 4, 15, 16, 27, 28, 39, 42, 40, 88, 89, 52, 53, 71, 76, 83, 77, 102, 103, 104, 100 ],
  [ 5, 6, 17, 18, 29, 30, 41, 46, 44, 90, 93, 54, 57, 65, Keys.None, Keys.None, Keys.None, 105, 106, 107, Keys.None ],
  [ 9, 8, 19, 20, 31, 34, 32, 45, 43, 91, 92, 55, Keys.None, 66, Keys.None, 78, Keys.None, 108, 109, 100, 101 ],
  [ 10, 22, 21, Keys.None, Keys.None, Keys.None, 33, Keys.None, Keys.None, Keys.None, 94, 58, 67, 68, 70, 79, 82, Keys.None, 111, 112, Keys.None ]
], pwm = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d,
  0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d,
  0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d
];

const RGB = {
  Modes: { Direct: 0, Array: 1, Profile: 2 },
  RawBufferSize: 96,
  Rows: 6,
  ColsOne: 17,
  ColsTwo: 21,
  Part0: 0,
  Part1: 1,
  Part2: 2,
  Part3: 3,
  Part4: 4,
  LedLeftShiftANSI: 9,
  LedLeftShiftISO: 7,
  LedEnterANSI: 65,
  LedEnterISO: 62
};

const USB = {
  // queries
  GetRgbMainProfile: 6,
  GetRgbColorsPart1: 26,
  GetRgbColorsPart2: 27,
  GetRgbEffects: 28,
  RefreshRgbColors: 29,
  SdkSingleColor: 30,
  SdkResetColor: 31,
  SdkResetAll: 32,
  SdkInit: 33,
  // commands
  RgbMainPart: 0,
  RgbColorsPart: 9,
  SdkColorsReport: 11
};
function gc(r, g, b, c) {
  let f = (n) => Math.min(Math.floor(n), 255);
  let m = (n, c) => f(255 * Math.pow(n / 255, (c * 2.2)));
  return { r: m(r, c.r), g: m(g, c.g), b: m(b, c.b) };
}
class LedController {
  constructor() {
    this._kb = undefined;
    this._mode = RGB.Modes.Array;
    this._autoUpd = false;
    this._init = false;
    this.profileMap = [];
    let map = this.sdkMap = [];
    for (let i = 0; i < 5; i++) {
      map[i] = new Array(RGB.RawBufferSize);
      map[i].fill(0);
      map[i].changed = false;
    }
    this.sdkEnabled = false;
    this.profile = undefined;
    this.gammaCorrection = { r: 1, g: 1, b: 1 };
  }
  set mode(m) {
    if ((m < 0) || (m > 2)) { throw new Error(`Invalid LED mode ${m}`); }
    this._mode = m;
  }
  get mode() { return this._mode; }
  set kb(b) {
    if (!b.connected()) { throw new Error(`Keyboard isn't connected`); }
    this._kb = b;
    this.profileMap = new Array((b.deviceConfig.isTwo ? 118 : 96) * 3);
    let map = this.sdkMap;
    for (let i = 0; i < 5; i++) {
      map[i].fill(0);
      map[i].changed = false;
    }
  }
  get kb() { return this._kb; }
  set autoUpd(v) { this._autoUpd = !!v; }
  get autoUpd() { return this._autoUpd; }

  loadCurrentProfile(set = true) {
    let { kb } = this, ind;
    if (!kb) { return false; }
    ind = kb.getCurrentProfile();
    if (ind == -1) { return false; }
    if (!(this.profile = this.loadProfile(ind, set))) { return false; }
    return true;
  }
  loadProfile(n = 0, set = true) {
    let { kb } = this;
    let main, color1, color2, effects, buffer;
    if ((n < 0) || (n > 3)) { return false; }
    if (!(buffer = kb.sendQuery(USB.GetRgbMainProfile, n))) { return false; }
    main = buffer.slice(0, 6);
    if (!(buffer = kb.sendQuery(USB.GetRgbColorsPart1, n))) { return false; }
    color1 = buffer.slice(0, kb.deviceConfig.isTwo ? 118 : 96);
    if (!(buffer = kb.sendQuery(USB.GetRgbColorsPart2, n))) { return false; }
    color2 = buffer.slice(0, kb.deviceConfig.isTwo ? 118 : 96);
    if (!(buffer = kb.sendQuery(USB.GetRgbEffects, n))) { return false; }
    effects = buffer.slice(0, 5);
    let unpackRgb = (a) => { let p = (a[1] << 8) | a[0]; return [(p & 0xf800) >> 8,(p & 0x7e0) >> 3,(p & 0x1f) << 3]; };
    let unpackMap = () => {
      let a = [...color1, ...color2], out = [];
      for (let i = 0, l = a.length; i < l; i += 2) { out.push(...unpackRgb([a[i], a[i + 1]])); }
      return out;
    }, c = unpackRgb(main.slice(2, 4));
    let profile = {
      id: n,
      brightness: main[1],
      capsLockColor: c,
      fnLockColor: unpackRgb(main.slice(4, 6)),
      scrollLockColor: [ c[0], c[1], c[2] ],
      numLockColor: [ c[0], c[1], c[2] ],
      winLockColor: [ c[0], c[1], c[2] ],
      map: unpackMap(),
      effects: {
        mode: main[0],
        idleBrightness: effects[0],
        speed: effects[1],
        colorChoice: effects[2],
        size: effects[3],
        special: effects[4]
      }
    };
    if (set) { return this.setColormap(profile.map)?profile:false; }
    return profile;
  }
  setBrightness(n) {
    let { kb } = this;
    if (!kb) { return false; }
    if ((n < 0) || (n > 255)) { return false; }
    if (!this.profile) { if (!this.loadCurrentProfile(false)) { return false; } }
    if (this.sdkEnabled) { return false; }
    let { profile } = this;
    let packRgb = (rgb) => { let x = ((0xf8 & rgb[0]) << 8) | ((0xfc & rgb[1]) << 3) | ((0xf8 & rgb[2]) >> 3); return [ x & 0xff, (x & 0xff00) >> 8 ]; };
    let buf = [ USB.RgbMainPart, profile.effects.mode, n, ...packRgb(profile.capsLockColor), ...packRgb(profile.fnLockColor) ];
    if (!kb.sendCommand(buf)) { return false; }
    if (!kb.sendQuery(USB.RefreshRgbColors)) { return false; }
    return true;
  }

  enableSdk(ks = true) {
    let s = !!ks, { kb } = this;
    if (!kb) { return false; }
    if (ks == this.sdkEnabled) { return true; }
    if (ks) {
      if (!kb.sendQuery(USB.SdkInit)) { return false; }
      this.sdkEnabled = true;
      return true;
    } else { return this.reset(); }
  }
  reset() {
    let { kb } = this;
    if (!kb) { return false; }
    if (!kb.sendQuery(USB.SdkResetAll)) { return false; }
    else { this.sdkEnabled = false; return true; }
  }
  getSafeLedIndex(row, col) {
    let { kb } = this, { None } = Keys;
    if (!kb) { return None; }
    if ((row < 0) || (col < 0)) { return None; }
    else if (row >= RGB.Rows) { return None; }
    else if ((!kb.deviceConfig.isTwo) && (col >= RGB.ColsOne)) { return None; }
    else if ((kb.deviceConfig.isTwo) && (col >= RGB.ColsTwo)) { return None; }
    return rgbLedIndex[row][col];
  }


  init() {
    let { Direct, Array, Profile } = RGB.Modes;
    let { kb } = this, ret = false;
    if (!kb) { return false; }
    if (!this.loadCurrentProfile(false)) { return false; }
    switch (this.mode) {
      case Direct: ret = this.enableSdk(); break;
      case Array: if (!this.enableSdk()) { return false; } ret = this.arrayChangeColormap(this.profile.map); break;
      case Profile: ret = this.profileChangeColormap(this.profile.map); break;
      default: return false;
    }
    this.setColormap(this.profile.map);
    this._init = true;
    return ret;
  }
  setLoc(row, col, r, g, b) {
    let { Direct, Array, Profile } = RGB.Modes;
    switch (this.mode) {
      case Direct: return this.directSetLoc(row, col, r, g, b);
      case Array: return this.arraySetLoc(row, col, r, g, b);
      case Profile: return this.profileSetLoc(row, col, r, g, b);
      default: return false;
    }
  }
  setKey(key, r, g, b) {
    let { Direct, Array, Profile } = RGB.Modes;
    switch (this.mode) {
      case Direct: return this.directSetKey(key, r, g, b);
      case Array: return this.arraySetKey(key, r, g, b);
      case Profile: return this.profileSetKey(key, r, g, b);
      default: return false;
    }
  }
 resetLoc(row, col) {
    let { Direct, Array, Profile } = RGB.Modes;
    switch (this.mode) {
      case Direct: return this.directResetLoc(row, col);
      case Array: return this.arrayResetLoc(row, col);
      case Profile: return this.profileResetLoc(row, col);
      default: return false;
    }
  }
  resetKey(key) {
    let { Direct, Array, Profile } = RGB.Modes;
    switch (this.mode) {
      case Direct: return this.directResetKey(key);
      case Array: return this.arrayResetKey(key);
      case Profile: return this.profileResetKey(key);
      default: return false;
    }
  }
  setColormap(map) {
    let { Array, Profile } = RGB.Modes;
    switch (this.mode) {
      case Array: return this.arraySetColormap(map);
      case Profile: return this.profileSetColormap(map);
      default: return false;
    }
  }
  updateKeyboard(force = false) {
    let { Direct, Array, Profile } = RGB.Modes;
    switch (this.mode) {
      case Direct: return true;
      case Array: return this.arrayUpdateKeyboard(force);
      case Profile: return this.profileUpdateKeyboard(force);
      default: return false;
    }
  }


  // direct
  directSetLoc(row, col, r, g, b) { return this.directSetKey(this.getSafeLedIndex(row, col), r, g, b); }
  directSetKey(keyCode, ir, ig, ib) {
    let { kb } = this, { r, g, b } = gc(ir, ig, ib, this.gammaCorrection);
    if (!kb) { return false; }
    else if (!this.sdkEnabled) { return false; }
    else if (keyCode == Keys.None) { return false; }
    else if (keyCode >= 118) { return false; }
    else if ((!kb.deviceConfig.isTwo) && (keyCode >= 96)) { return false; }
    else if (keyCode == RGB.LeftShiftANSI) {
      let ansi = kb.sendQuery(USB.SdkSingleColor, b, g, r, RGB.LeftShiftANSI) !== undefined,
          iso = kb.sendQuery(USB.SdkSingleColor, b, g, r, RGB.LeftShiftISO) !== undefined;
      return ansi && iso;
    }
    else if (keyCode == RGB.EnterANSI) {
      let ansi = kb.sendQuery(USB.SdkSingleColor, b, g, r, RGB.EnterANSI) !== undefined,
          iso = kb.sendQuery(USB.SdkSingleColor, b, g, r, RGB.EnterISO) !== undefined;
      return ansi && iso;
    }
    return kb.sendQuery(USB.SdkSingleColor, b, g, r, keyCode) !== undefined;
  }
  directResetLoc(row, col) { return this.directResetKey(this.getSafeLedIndex(row, col)); }
  directResetKey(keyCode) {
    let { kb } = this;
    if (!kb) { return false; }
    else if (!this.sdkEnabled) { return false; }
    else if (keyCode == Keys.None) { return false; }
    else if (keyCode >= 118) { return false; }
    else if ((!kb.deviceConfig.isTwo) && (keyCode >= 96)) { return false; }
    else if (keyCode == RGB.LeftShiftANSI) {
      let ansi = kb.sendQuery(USB.SdkResetSingle, RGB.LeftShiftANSI) !== undefined,
          iso = kb.sendQuery(USB.SdkResetSingle, RGB.LeftShiftISO) !== undefined;
      return ansi && iso;
    }
    else if (keyCode == RGB.EnterANSI) {
      let ansi = kb.sendQuery(USB.SdkResetSingle, RGB.EnterANSI) !== undefined,
          iso = kb.sendQuery(USB.SdkResetSingle, RGB.EnterISO) !== undefined;
      return ansi && iso;
    }
    return kb.sendQuery(USB.SdkResetColor, keyCode) !== undefined;
  }

  // array
  sendSdkCommand(part, rgb) {
    let { kb } = this, { RawBufferSize, Part0, Part1, Part2, Part3, Part4 } = RGB;
    if (!kb) { return false; }
    if (!this.sdkEnabled) { return false; }
    if ((part == Part4) && (!kb.deviceConfig.isTwo)) { return false; }
    let buf = new Array(RawBufferSize + 3), { gammaCorrection } = this;
    buf.fill(0);
    buf[0] = USB.SdkColorsReport;
    switch (part) {
      case Part0: buf[1] = 0; buf[2] = 0; break;
      case Part1: buf[1] = 0; buf[2] = RawBufferSize; break;
      case Part2: buf[1] = 1; buf[2] = 0; break;
      case Part3: buf[1] = 1; buf[2] = RawBufferSize; break;
      case Part4: buf[1] = 2; buf[2] = 0; break;
    }
    for (let i = 0, l = 24; i < l; i++) {
      let x = pwm[i], { r, g, b } = gc(rgb[x], rgb[x + 0x10], rgb[x + 0x20], gammaCorrection);
      buf[x + 3] = r;
      buf[x + 0x10 + 3] = g;
      buf[x + 0x20 + 3] = b;
    }
    return kb.sendCommand(buf);
  }
  arrayUpdateKeyboard(force = false) {
    let { kb, sdkMap } = this, bufIndex;
    let Parts = [ RGB.Part0, RGB.Part1, RGB.Part2, RGB.Part3, RGB.Part4 ];
    if (!kb) { return false; }
    if (!this.sdkEnabled) { return false; }
    for (let i = 0, l = kb.deviceConfig.isTwo ? 5 : 4; i < l; i++) {
      if ((sdkMap[i].changed) || (force)) {
        if (!this.sendSdkCommand(Parts[i], sdkMap[i])) { return false; }
        sdkMap[i].changed = false;
      }
    }
    return true;
  }
  arrayChangeLoc(row, col, r, g, b) { return this.arrayChangeKey(this.getSafeLedIndex(row, col), r, g, b); }
  arrayChangeKey(keyCode, r, g, b) {
    let { kb, sdkMap } = this, buf, bufIndex;
    if (!kb) { return false; }
    else if (!this.sdkEnabled) { return false; }
    else if (keyCode >= 118) { return false; }
    else if ((!kb.deviceConfig.isTwo) && (keyCode >= 96)) { return false; }
    if (keyCode >= 96) { buf = sdkMap[4]; }
    else if (keyCode >= 72) { buf = sdkMap[3]; }
    else if (keyCode >= 48) { buf = sdkMap[2]; }
    else if (keyCode >= 24) { buf = sdkMap[1]; }
    else { buf = sdkMap[0]; }
    bufIndex = pwm[keyCode % 24];
    let cr = buf[bufIndex], cg = buf[bufIndex + 0x10], cb = buf[bufIndex + 0x20];
    if ((r == cr) && (g == cg) && (b == cb)) { return true; }
    buf.changed = true;
    buf[bufIndex] = r;
    buf[bufIndex + 0x10] = g;
    buf[bufIndex + 0x20] = b;
    if (keyCode == RGB.LeftShiftANSI) {
      let ind = pwm[RGB.LeftShiftISO];
      buf[ind] = r;
      buf[ind + 0x10] = g;
      buf[ind + 0x20] = b;
    }
    else if (keyCode == RGB.EnterANSI) {
      let ind = pwm[RGB.EnterISO-48];
      buf[ind] = r;
      buf[ind + 0x10] = g;
      buf[ind + 0x20] = b;
    }
    return true;
  }
  arrayChangeResetLoc(row, col) { return this.arrayChangeResetKey(this.getSafeLedIndex(row, col)); }
  arrayChangeResetKey(keyCode) {
    if (!this.profile) { if (!this.loadCurrentProfile(false)) { return false; } }
    let { map } = this.profile;
    return this.arrayChangeKey(keyCode, map[keyCode * 3], map[keyCode * 3 + 1], map[keyCode * 3  + 2]);
  }
  arrayChangeColormap(map) {
    let { kb } = this;
    if (!kb) { return false; }
    if (!this.sdkEnabled) { return false; }
    for (let i = 0, l = kb.deviceConfig.isTwo ? 118 : 96; i < l; i++) {
      if (!this.arrayChangeKey(i, map[i * 3], map[i * 3 + 1], map[i * 3 + 2])) { return false; }
    }
    return true;
  }
  arrayChangeColormapArray(arr) {
    let { kb } = this;
    if (!kb) { return false; }
    if (!this.sdkEnabled) { return false; }
    let index = 0;
    for (let row = 0, rl = RGB.Rows; row < cl; row++) {
      for (let col = 0, cl = kb.deviceConfig.isTwo ? RGB.ColsTwo : RGB.ColsOne; col < cl; col++) {
        let r = map[index],
            g = map[index + 1],
            b = map[index + 2];
        if (!this.arrayChangeLoc(row, col, r, g, b)) { return false; }
        index += 3;
      }
    }
    return true;
  }
  arraySetLoc(row, col, r, g, b) {
    if (!this.arrayChangeLoc(row, col, r, g, b)) { return false; }
    if (this.autoUpd) { return this.arrayUpdateKeyboard(); }
    return true;
  }
  arraySetKey(keyCode, r, g, b) {
    if (!this.arrayChangeKey(keyCode, r, g, b)) { return false; }
    if (this.autoUpd) { return this.arrayUpdateKeyboard(); }
    return true;
  }
  arrayResetLoc(row, col) {
    if (!this.arrayChangeResetLoc(row, col)) { return false; }
    if (this.autoUpd) { return this.arrayUpdateKeyboard(); }
    return true;
  }
  arrayResetKey(keyCode) {
    if (!this.arrayChangeResetKey(keyCode)) { return false; }
    if (this.autoUpd) { return this.arrayUpdateKeyboard(); }
    return true;
  }
  arraySetColormap(map) {
    if (!this.arrayChangeColormap(map)) { return false; }
    if (this.autoUpd) { return this.arrayUpdateKeyboard(); }
    return true;
  }
  arraySetColormapArray(arr) {
    if (!this.arrayChangeColormapArray(arr)) { return false; }
    if (this.autoUpd) { return this.arrayUpdateKeyboard(); }
    return true;
  }

  // profile
  profileUpdateKeyboard(force = false) {
    let { kb, profileMap } = this;
    if (!kb) { return false; }
    if (this.sdkEnabled) { return false; }
    if (!this.profile) { if (!this.loadCurrentProfile(false)) { return false; } }
    let classifyEffects = (effects) => {
      switch (effects.mode) {
        case 0: case 2: case 3: case 7: case 8: case 9: return true;
        case 5: case 6: return effects.colorChoice == 0;
        default: return false;
      }
    };
    if ((!force) && (!classifyEffects(this.profile.effects))) { return false; }
    let size = kb.deviceConfig.isTwo ? 118 : 96;
    if (profileMap.length < size * 3) { return false; }
    let packRgb = (rgb) => { let x = ((0xf8 & rgb[0]) << 8) | ((0xfc & rgb[1]) << 3) | ((0xf8 & rgb[2]) >> 3); return [ x & 0xff, (x & 0xff00) >> 8 ]; };
    let packMap = (map) => {
      let out = [];
      for (let i = 0, l = map.length; i < l; i+=3) { out.push(...packRgb(map.slice(i, i + 3))); }
      return out;
    };
    let pm = packMap(profileMap),
        p1 = [ USB.RgbColorsPart, 0, (size / 2) - 1, ...pm.slice(0, size) ],
        p2 = [ USB.RgbColorsPart, size / 2, size - 1, ...pm.slice(size) ];
    if (!kb.sendCommand(p1)) { return false; }
    if (!kb.sendCommand(p2)) { return false; }
    if (!kb.sendQuery(USB.RefreshRgbColors)) { return false; }
    return true;
  }
  profileChangeLoc(row, col, r, g, b) { return this.profileChangeKey(this.getSafeLedIndex(row, col), r, g, b); }
  profileChangeKey(keyCode, r, g, b) {
    let { kb, profileMap } = this;
    if (!kb) { return false; }
    if (this.sdkEnabled) { return false; }
    profileMap[keyCode * 3] = r;
    profileMap[keyCode * 3 + 1] = g;
    profileMap[keyCode * 3 + 2] = b;
    return true;
  }
  profileChangeResetLoc(row, col) { return this.profileChangeResetKey(this.getSafeLedIndex(row, col)); }
  profileChangeResetKey(keyCode) {
    if (!this.profile) { if (!this.loadCurrentProfile(false)) { return false; } }
    let { map } = this.profile;
    return this.profileChangeKey(keyCode, map[keyCode * 3], map[keyCode * 3 + 1], map[keyCode * 3 + 2]);
  }
  profileChangeColormap(map) {
    let { kb, profileMap } = this;
    if (!kb) { return false; }
    if (this.sdkEnabled) { return false; }
    for (let i = 0, l = profileMap.length; i < l; i++) { profileMap[i] = map[i] || 0; }
    return true;
  }
  profileSetLoc(row, col, r, g, b) {
    if (!this.profileChangeLoc(row, col, r, g, b)) { return false; }
    if (this.autoUpd) { return this.profileUpdateKeyboard(); }
    return true;
  }
  profileSetKey(keyCode, r, g, b) {
    if (!this.profileChangeKey(keyCode, r, g, b)) { return false; }
    if (this.autoUpd) { return this.profileUpdateKeyboard(); }
    return true;
  }
  profileResetLoc(row, col) {
    if (!this.profileChangeResetLoc(row, col)) { return false; }
    if (this.autoUpd) { return this.profileUpdateKeyboard(); }
    return true;
  }
  profileResetKey(keyCode) {
    if (!this.profileChangeResetKey(keyCode)) { return false; }
    if (this.autoUpd) { return this.profileUpdateKeyboard(); }
    return true;
  }
  profileSetColormap(map) {
    if (!this.profileChangeColormap(map)) { return false; }
    if (this.autoUpd) { return this.profileUpdateKeyboard(); }
    return true;
  }
}
LedController.Modes = RGB.Modes;
module.exports = { LedController, Keys, RGB, rgbLedIndex };
