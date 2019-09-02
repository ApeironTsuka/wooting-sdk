const HID = require('node-hid'),
      { AnalogController, Keys: AKeys } = require('./analogcontroller.js'),
      { LedController, Keys: LKeys } = require('./ledcontroller.js');
const USB = {
  CommandSize: 129,
  ReportSize: 8,
  VID: 0x03eb,
  ONE_PID: 0xff01,
  TWO_PID: 0xff02,
  ANALOG_PAGE: 0xFFFF,
  CONFIG_PAGE: 0x1337,
  // queries
  GetVersion: 1,
  GetSerial: 3,
  GetCurrentRgbProfileIndex: 5,
  LoadRgbProfile: 7,
  GetDigitalProfile: 12,
  GetAnalogProfileMainPart: 13,
  GetKeyDescriptorDataProfile: 18,
  GetDeviceConfig: 19,
  ActivateProfile: 23,
  // response codes
  Unknown: 102,
  Success: 136,
  Error: 255
};
class Keyboard {
  constructor() {
    this.sn = undefined;
    this.version = undefined;
    this.analoghdl = undefined;
    this.ledhdl = undefined;
    this._init = false;
    this.paused = false;
    this.locks = { num: false, caps: false, scroll: false, fn: false, win: false };
  }
  init() {
    if (!this.connected()) { return false; }
    if (this._init) { return true; }
    this._init = true;
    this.getSerialNumber();
    this.getDeviceConfig();
    this.getFnKeys();
    this.getActuationPoint();
    this.getDigitalEnabled(this.getCurrentProfile());
    this.leds = new LedController();
    this.leds.kb = this;
    this.analog = new AnalogController();
    this.analog.kb = this;
    return true;
  }
  disconnect() {
    if (this.leds) { this.leds.reset(); }
    if (this.analoghdl) { this.analoghdl.close(); this.analoghdl = undefined; }
    if (this.ledhdl) { this.ledhdl.close(); this.ledhdl = undefined; }
  }
  connected() { return this.analoghdl && this.ledhdl && !this.paused; }
  pause() {
    this._ledsdk = this.leds.sdkEnabled;
    if (this._ledsdk) { this.leds.reset(); }
    this.paused = true;
  }
  resume() {
    let clear;
    // Clear out any replies on this interface from calls other apps made while paused
    while (clear = this.ledhdl.readTimeout(0)) { if (clear.length == 0) { break; } }
    this.paused = false;
    if (this._ledsdk) {
      this.getDeviceConfig();
      this.getFnKeys();
      this.getActuationPoint();
      this.getDigitalEnabled(this.getCurrentProfile());
      this.leds.enableSdk();
      this.leds.loadCurrentProfile();
      this.leds.updateKeyboard(true);
    }
  }

  sendCommand(inbuf, force) {
    let { CommandSize } = USB;
    if ((!this.connected()) && (!force)) { return false; }
    let buf = new Array(CommandSize);
    buf.fill(0);
    buf[0] = 0;
    buf[1] = 0xd0;
    buf[2] = 0xda;
    for (let i = 0, l = inbuf.length; i < l; i++) {
      if (i+3 >= CommandSize - 2) { return false; }
      buf[i+3] = inbuf[i];
    }
    let crc = Keyboard.getCrc16ccitt(buf, CommandSize - 2);
    buf[127] = crc&0xff;
    buf[128] = crc >> 8;
    try { this.ledhdl.write(buf); return true; } catch (e) { return false; }
  }
  sendQuery(cmd, param0 = 0, param1 = 0, param2 = 0, param3 = 0, force) {
    let { ReportSize } = USB;
    if ((!this.connected()) && (!force)) { return undefined; }
    let buf = new Array(ReportSize);
    buf[0] = 0;
    buf[1] = 0xd0;
    buf[2] = 0xda;
    buf[3] = cmd;
    buf[4] = param0;
    buf[5] = param1;
    buf[6] = param2;
    buf[7] = param3;
    try {
      this.ledhdl.sendFeatureReport(buf);
      let buffer = this.ledhdl.readTimeout(20);
      if ((buffer.length < 128) ||
          (Keyboard.getCrc16ccitt(buffer, buffer.length - 2) != ((buffer[127] << 8) | buffer[126])) ||
          ((buffer[0] != 0xd0) || (buffer[1] != 0xda)) ||
          (buffer[3] != USB.Success)) { return undefined; }
      return buffer.slice(4, 126);
    }
    catch (e) {
      if (e.message.indexOf('could not send feature report to device') != -1) { return undefined; }
      throw e;
    }
  }

  getFirmwareVersion() {
    if (!this.connected()) { return undefined; }
    if (this.version) { return this.version; }
    let buffer;
    if (!(buffer = this.sendQuery(USB.GetVersion))) { return undefined; }
    let data = buffer.slice(0, 3);
    this.version = {
      set(d) { this.major = d[0]; this.minor = d[1]; this.patch = d[2]; return this; },
      toString() { return `${this.major}.${this.minor}.${this.patch}`; }
    };
    return this.version.set(data);
  }
  getSerialNumber() {
    if (!this.connected()) { return undefined; }
    if (this.sn) { return this.sn; }
    let buffer;
    if (!(buffer = this.sendQuery(USB.GetSerial))) { return undefined; }
    let data = buffer.slice(0, 10);
    this.sn = {
      set(d) {
        this.supplierNumber = (d[1] << 8) | d[0];
        this.year = d[2];
        this.week = d[3];
        this.productNumber = (d[5] << 8) | d[4];
        this.revision = (d[7] << 8) | d[6];
        this.productId = (d[9] << 8) | d[8];
        return this;
      },
      toString() {
        let pad = (v, k) => v.toString().padStart(k, '0');
        let { year, week, productNumber, revision, productId } = this;
        return `A01B${year}${pad(week, 2)}W${pad(productNumber, 2)}${revision}H${pad(productId, 5)}`;
      }
    };
    return this.sn.set(data);
  }
  getDeviceConfig() {
    if (!this.connected()) { return undefined; }
    if (this.deviceConfig) { return this.deviceConfig; }
    let buffer;
    if (!(buffer = this.sendQuery(USB.GetDeviceConfig))) { return undefined; }
    let getName = (k) => { for (let i = 0, keys = Object.keys(AKeys), l = keys.length; i < l; i++) { if (AKeys[keys[i]] == k) { return keys[i]; } } return undefined; };
    return this.deviceConfig = {
      isOne: !this.isTwo,
      isTwo: this.isTwo,
      defaultDigitalProfile: buffer[0] & 0x1,
      xinputDisabled: (buffer[0] & 0x80) == 1,
      tachyonEnabled: (buffer[0] & 0x40) == 1,
      windowsKeyDisabled: (buffer[0] & 0x20) == 1,
      defaultAnalogProfile: buffer[1],
      defaultMode: buffer[2],
      fnKey: { analog: buffer[3], led: LKeys[getName(buffer[3])] },
      modeKey: { analog: buffer[4], led: LKeys[getName(buffer[4])] },
      layout: buffer[5],
      isANSI: buffer[5] == 0,
      isISO: buffer[5] == 1,
      fnLockedDefault: buffer[6] > 0
    };
  }
  getFnKeys() {
    if (!this.connected()) { return undefined; }
    if (this.fnKeys) { return this.fnKeys; }
    let buffer, n;
    if (!(buffer = this.sendQuery(USB.GetKeyDescriptorDataProfile))) { return undefined; }
    let getName = (k) => { for (let i = 0, keys = Object.keys(AKeys), l = keys.length; i < l; i++) { if (AKeys[keys[i]] == k) { return keys[i]; } } return undefined; };
    let findIndex = (k) => { let i = buffer.findIndex((n) => n >> 2 == k); return (i > 0 ? i : 255); };
    return this.fnKeys = {
      fnLock: { analog: n = findIndex(1), led: LKeys[getName(n)] },
      mediaNext: { analog: n = findIndex(2), led: LKeys[getName(n)] },
      mediaPrev: { analog: n = findIndex(3), led: LKeys[getName(n)] },
      mediaPlay: { analog: n = findIndex(4), led: LKeys[getName(n)] },
      mediaMute: { analog: n = findIndex(5), led: LKeys[getName(n)] },
      mediaVolUp: { analog: n = findIndex(6), led: LKeys[getName(n)] },
      mediaVolDown: { analog: n = findIndex(7), led: LKeys[getName(n)] },
      brightnessUp: { analog: n = findIndex(8), led: LKeys[getName(n)] },
      brightnessDown: { analog: n = findIndex(9), led: LKeys[getName(n)] },
      selectAnalogProfile1: { analog: n = findIndex(10), led: LKeys[getName(n)] },
      selectAnalogProfile2: { analog: n = findIndex(11), led: LKeys[getName(n)] },
      selectAnalogProfile3: { analog: n = findIndex(12), led: LKeys[getName(n)] },
      toggleWinkeyDisable: { analog: n = findIndex(13), led: LKeys[getName(n)] }
    };
  }
  getActuationPoint() {
    if (!this.connected()) { return -1; }
    let buffer;
    if (!(buffer = this.sendQuery(USB.GetDigitalProfile))) { return -1; }
    // inverted as the analog API is up 0, down 255, while internally it's up 255, down 0
    return this.actuationPoint = 255-buffer[0];
  }
  getDigitalEnabled(n = 0) {
    if (!this.connected()) { return false; }
    if (n == 0) { return this.digitalEnabled = true; }
    if ((n < 1) || (n > 3)) { return false; }
    let buffer;
    if (!(buffer = this.sendQuery(USB.GetAnalogProfileMainPart, n-1))) { return false; }
    return this.digitalEnabled = buffer[1] == 1;
  }
  getCurrentProfile() {
    let buffer;
    if (!this.connected()) { return -1; }
    if (!(buffer = this.sendQuery(USB.GetCurrentRgbProfileIndex))) { return -1; }
    return buffer[0];
  }
  useProfile(n = 0) {
    if (!this.connected()) { return false; }
    if ((n < 0) || (n > 3)) { return false; }
    let sdk = this.leds.sdkEnabled;
    if (sdk) { this.leds.enableSdk(false); }
    if (!this.sendQuery(USB.ActivateProfile, n)) { return false; }
    if (!this.sendQuery(USB.LoadRgbProfile, n)) { return false; }
    if (sdk) { this.leds.enableSdk(true); }
    if (this.leds._init) { if (!(this.leds.profile = this.leds.loadProfile(n))) { return false; } }
    this.getActuationPoint();
    this.getDigitalEnabled(n);
    return true;
  }

  static getCrc16ccitt(buf, size) {
    let crc = 0, ind = 0;
    while (size--) {
      crc ^= (buf[ind++] << 8);
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) { crc = (crc << 1) ^ 0x1021; }
        else { crc = crc << 1; }
      }
    }
    return crc & 0xffff;
  }
  static _deviceList() {
    let { VID, ONE_PID, TWO_PID } = USB, pages = true, sn = false;
    let devices = HID.devices();
    for (let i = 0, l = devices.length; i < l; i++) {
      if ((devices[i].vendorId != VID) ||
          ((devices[i].productId != ONE_PID) &&
           (devices[i].productId != TWO_PID))) {
        devices.splice(i, 1);
        i--;
        l--;
      } else {
        if (devices[i].usagePage === undefined) { pages = false; }
        if (devices[i].serialNumber !== undefined) { sn = true; }
      }
    }
    Keyboard._pages = pages;
    Keyboard._sn = sn;
    return devices;
  }
  static _fixupNoSN(board) {
    if (board) {
      if ((!board.ledhdl) || (!board.analoghdl)) {
        if (board.ledhdl) { board.ledhdl.close(); }
        if (board.analoghdl) { board.analoghdl.close(); }
        return false;
      }
      else if (!board.init()) { board.ledhdl.close(); board.analoghdl.close(); return false; }
      else { return board; }
    }
    return false;
  }
  static _fixupSN(list) {
    let out = [], sn;
    for (let i = 0, keys = Object.keys(list), l = keys.length; i < l; i++) {
      sn = list[keys[i]];
      if ((sn.ledhdl) && (sn.analoghdl)) {
        let board = new Keyboard();
        board.ledhdl = sn.ledhdl;
        board.analoghdl = sn.analoghdl;
        board.isTwo = sn.isTwo;
        if (board.init()) { out.push(board); }
        else { board.ledhdl.close(); board.analoghdl.close(); }
      } else {
        if (sn.ledhdl) { sn.ledhdl.close(); }
        if (sn.analoghdl) { sn.analoghdl.close(); }
      }
    }
    return out;
  }
  static getUnpatchedNoSN(devices) {
    let { TWO_PID } = USB, board, found = false, n, hn = 0;
    for (let i = 0, l = devices.length; i < l; i++) {
      if (devices[i].interface > hn) { hn = devices[i].interface; }
    }
    n = hn-4;
    for (let i = 0, l = devices.length; i < l; i++) {
      if (devices[i].interface == n) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        if (!board) { board = new Keyboard(); }
        board.ledhdl = hdl;
      } else if (devices[i].interface == hn) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        if (!board) { board = new Keyboard(); }
        board.analoghdl = hdl;
        board.isTwo = devices[i].productId == TWO_PID;
      }
    }
    return Keyboard._fixupNoSN(board);
  }
  static getUnpatchedSN(devices) {
    let { TWO_PID } = USB, list = {}, sn;
    for (let i = 0, l = devices.length; i < l; i++) {
      sn = devices[i].serialNumber;
      if (!list[sn]) { list[sn] = { hn: 0 }; }
      if (devices[i].interface > list[sn].hn) { list[sn].hn = devices[i].interface; list[sn].n = list[sn].hn - 4; }
    }
    for (let i = 0, l = devices.length; i < l; i++) {
      sn = devices[i].serialNumber;
      if (devices[i].interface == list[sn].n) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        list[sn].ledhdl = hdl;
      } else if (devices[i].interface == list[sn].hn) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        list[sn].analoghdl = hdl;
        list[sn].isTwo = devices[i].productId == TWO_PID;
      }
    }
    return Keyboard._fixupSN(list);
  }
  static getNoSN(devices) {
    let { TWO_PID, ANALOG_PAGE, CONFIG_PAGE } = USB, board;
    for (let i = 0, l = devices.length; i < l; i++) {
      if (devices[i].usagePage == CONFIG_PAGE) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        if (!board) { board = new Keyboard(); }
        board.ledhdl = hdl;
      } else if (devices[i].usagePage == ANALOG_PAGE) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        if (!board) { board = new Keyboard(); }
        board.analoghdl = hdl;
        board.isTwo = devices[i].productId == TWO_PID;
      }
    }
    return Keyboard._fixupNoSN(board);
  }
  static getSN(devices) {
    let { TWO_PID, ANALOG_PAGE, CONFIG_PAGE } = USB, list = {}, sn;
    for (let i = 0, l = devices.length; i < l; i++) {
      sn = devices[i].serialNumber;
      if (devices[i].usagePage == CONFIG_PAGE) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        if (!list[sn]) { list[sn] = {}; }
        list[sn].ledhdl = hdl;
      } else if (devices[i].usagePage == ANALOG_PAGE) {
        let hdl = new HID.HID(devices[i].path);
        if (!hdl) { continue; }
        if (!list[sn]) { list[sn] = {}; }
        list[sn].analoghdl = hdl;
        list[sn].isTwo = devices[i].productId == TWO_PID;
      }
    }
    return Keyboard._fixupSN(list);
  }
  static getAll() {
    let devices = Keyboard._deviceList();
    if (!Keyboard._sn) {
      // FIXME non-SN path currently doesn't detect multiple devices
      if (Keyboard._pages) { return [ Keyboard.getNoSN(devices) ]; }
      else { return [ Keyboard.getUnpatchedNoSN(devices) ]; }
    }
    if (Keyboard._pages) { return Keyboard.getSN(devices); }
    else { return Keyboard.getUnpatchedSN(devices); }
  }
  static get() { let all = Keyboard.getAll(); if (all[0] === undefined) { return false; } return all[0]; }
}
Keyboard.Analog = AKeys;
Keyboard.LEDs = LKeys;
Keyboard.Modes = LedController.Modes;
Keyboard._pages = false;
Keyboard._sn = false;
module.exports = { Keyboard };
