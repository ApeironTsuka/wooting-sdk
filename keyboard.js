const HID = require('node-hid'),
      { AnalogController, Keys: AKeys } = require('./analogcontroller.js'),
      { LedController, Keys: LKeys } = require('./ledcontroller.js');
const USB = {
  ReportSize: 129,
  CommandSize: 8,
  VID: 0x03eb,
  ONE_PID: 0xff01,
  TWO_PID: 0xff02,
  // reports
  GetVersion: 1,
  GetSerial: 3
};
class Keyboard {
  constructor() {
    this.sn = undefined;
    this.version = undefined;
    this.analoghdl = undefined;
    this.ledhdl = undefined;
  }
  init() {
    if (!this.connected()) { return false; }
    this.leds = new LedController();
    this.leds.kb = this;
    this.analog = new AnalogController();
    this.analog.kb = this;
    return true;
  }
  disconnect() {
    this.leds.reset();
    if (this.analoghdl) { this.analoghdl.close(); this.analoghdl = undefined; }
    if (this.ledhdl) { this.ledhdl.close(); this.ledhdl = undefined; }
  }
  connected() { return this.analoghdl && this.ledhdl; }

  sendBuffer(inbuf) {
    let { ReportSize } = USB;
    if (!this.connected()) { return false; }
    let buf = new Array(ReportSize);
    buf.fill(0);
    buf[0] = 0;
    buf[1] = 0xd0;
    buf[2] = 0xda;
    for (let i = 0, l = inbuf.length; i < l; i++) {
      if (i+3 >= ReportSize - 2) { return false; }
      buf[i+3] = inbuf[i];
    }
    let crc = Keyboard.getCrc16ccitt(buf, ReportSize - 2);
    buf[127] = crc&0xff;
    buf[128] = crc >> 8;
    try {
      if (this.ledhdl.write(buf) == ReportSize) { return true; }
      else { this.disconnect(); return false; }
    } catch (e) { this.disconnect(); throw e; }
  }
  sendFeature(cmd, param0 = 0, param1 = 0, param2 = 0, param3 = 0) {
    let { CommandSize } = USB;
    if (!this.connected()) { return false; }
    let buf = new Array(CommandSize);
    buf[0] = 0;
    buf[1] = 0xd0;
    buf[2] = 0xda;
    buf[3] = cmd;
    buf[4] = param0;
    buf[5] = param1;
    buf[6] = param2;
    buf[7] = param3;
    try {
      if (this.ledhdl.sendFeatureReport(buf) == CommandSize) { return true; }
      else { this.disconnect(); return false; }
    } catch (e) { this.disconnect(); throw e; }
  }

  getFirmwareVersion() {
    if (!this.connected()) { return undefined; }
    if (this.version) { return this.version; }
    if (!this.sendFeature(USB.GetVersion)) { return undefined; }
    let data = this.ledhdl.readSync().slice(4, 7);
    this.version = {
      set(d) { this.major = d[0]; this.minor = d[1]; this.patch = d[2]; return this; },
      toString() { return `${this.major}.${this.minor}.${this.patch}`; }
    };
    return this.version.set(data);
  }
  getSerialNumber() { // FIXME: Currently broken; reports incorrect serial (which the Wootility does as well at the moment)
    if (!this.connected()) { return undefined; }
    if (this.sn) { return this.sn; }
    if (!this.sendFeature(USB.GetSerial)) { return undefined; }
    let data = this.ledhdl.readSync().slice(4, 14);
    this.sn = {
      set(d) {
        this.supplierNumber = (d[1] << 8) | d[0];
        this.year = d[2];
        this.week = d[3];
        this.productNumber = (d[5] << 8) | d[4];
        this.revision = (d[7] << 8) | d[6];
        this.productId = (d[9] << 8) | d[7];
        return this;
      },
      toString() {
        let pad = (v, k) => v.toString().padStart(k, '0');
        let { year, week, productId, revision, productNumber } = this;
        return `A01B${year}${pad(week, 2)}W${pad(productId, 2)}${revision}H${pad(productNumber, 5)}`;
      }
    };
    return this.sn.set(data);
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
  static get() {
    let { VID, ONE_PID, TWO_PID } = USB;
    let board;
    let devices = HID.devices(), found = false, n, hn = 0;
    for (let i = 0, l = devices.length; i < l; i++) {
      if ((devices[i].vendorId != VID) ||
          ((devices[i].productId != ONE_PID) &&
           (devices[i].productId != TWO_PID))) {
        devices.splice(i, 1);
        i--;
        l--;
      }
    }
    if (devices.length == 0) { return false; }
    for (let i = 0, l = devices.length; i < l; i++) {
      if (devices[i].interface > hn) { hn = devices[i].interface; }
    }
    n = hn-4;
    for (let i = 0, l = devices.length; i < l; i++) {
      if (devices[i].interface == n) {
        let hdl = new HID.HID(devices[i].path);
        found = !!hdl;
        if (!found) { continue; }
        board = new Keyboard();
        board.ledhdl = hdl;
      } else if (devices[i].interface == hn) {
        if (!found) { continue; }
        let hdl = new HID.HID(devices[i].path);
        found = !!hdl;
        if (!found) { continue; }
        board.analoghdl = hdl;
        board.isTwo = devices[i].productId == TWO_PID;
        break;
      }
    }
    return found?board:false;
  }
}
Keyboard.Analog = AKeys;
Keyboard.LEDs = LKeys;
Keyboard.Modes = LedController.Modes;
module.exports = { Keyboard };
