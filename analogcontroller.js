const Keys = require('./analog.js');

const scanIndexArray = [
  [ 0, Keys.None, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 107, 108, 109, 110 ],
  [ 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 61, 106, 105, 104, 103 ],
  [ 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 62, 102, 101, 100, 99 ],
  [ 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 45, 60, Keys.None, Keys.None, Keys.None, 98, 97, 96, Keys.None ],
  [ 64, 87, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, Keys.None, 75, Keys.None, 63, Keys.None, 90, 91, 92, 93 ],
  [ 80, 81, 82, Keys.None, Keys.None, Keys.None, 83, Keys.None, Keys.None, Keys.None, 84, 85, 86, 79, 76, 77, 78, Keys.None, 95, 94, Keys.None ]
];

const Analog = {
  Rows: 6,
  ColsOne: 17,
  ColsTwo: 21,
  BufferSize: 32
};

class AnalogController {
  constructor() {
    this.buffer = [];
    this.allKeys = undefined;
    this._kb = undefined;
    this._autoUpd = false;
    this.tmr = undefined;
  }
  set kb(b) {
    if (!b.connected()) { throw new Error(`Keyboard isn't connected`); }
    this._kb = b;
    this.hdl = b.analoghdl;
    this.allKeys = new Array(b.isTwo?117:96);
    this.allKeys.fill(0);
  }
  get kb() { return this._kb; }
  set autoUpd(v) {
    this._autoUpd = !!v;
    if (this._autoUpd) {
      let { BufferSize } = Analog;
      this.tmr = true;
      this.tmr = setInterval(() => {
        this.refreshBuffer();
        let { buffer, allKeys } = this;
        allKeys.fill(0);
        for (let i = 0; i < BufferSize; i += 2) { allKeys[buffer[i]] = Math.min(buffer[i+1], 255); }
      }, 5);
    }
    else if (this.tmr) { clearInterval(this.tmr); this.tmr = undefined; }
  }
  get autoUpd() { return this._autoUpd; }
  refreshBuffer() {
    let { kb, hdl } = this;
    if (!kb) { return false; }
    try {
      let b = [], { BufferSize } = Analog;
      while (b.length < BufferSize) { b = [...b, ...hdl.readTimeout(0)]; }
      this.buffer = b;
    } catch (e) { kb.disconnect(); return false; }
    return true;
  }
  readLoc(row, col) {
    let { kb } = this;
    if (!kb) { return 0; }
    else if (row >= Analog.Rows) { return 0; }
    else if ((!kb.isTwo) && (col >= Analog.ColsOne)) { return 0; }
    else if ((kb.isTwo) && (col >= Analog.ColsTwo)) { return 0; }
    return this.readKey(scanIndexArray[row][col]);
  }
  readKey(keyCode) {
    let { kb, buffer } = this, { BufferSize } = Analog;
    if (!kb) { return 0; }
    else if (keyCode == Keys.None) { return 0; }
    else if ((kb.isTwo) && (keyCode > 117)) { return 0; }
    else if ((!kb.isTwo) && (keyCode > 96)) { return 0; }
    if (!this.refreshBuffer()) { return 0; }
    if (this.autoUpd) { console.log(keyCode, this.allKeys[keyCode]); return this.allKeys[keyCode]; }
    for (let i = 1; (i < BufferSize) && (buffer[i] > 0); i += 2) {
      if (buffer[i-1] == keyCode) { return buffer[i]>255?255:buffer[i]; }
    }
    return 0;
  }
  readFull() {
    let { BufferSize } = Analog, keys = new Array(BufferSize), written = 0;
    if (this.autoUpd) {
      let { allKeys } = this, k = 0;
      for (let i = 0, l = allKeys.length; i < l; i++, k+=2) { if (allKeys[i] > 0) { keys[k] = i; keys[k+1] = allKeys[i]; written++; } }
    } else {
      if (!this.refreshBuffer()) { return undefined; }
      let { buffer } = this;
      for (let i = 0; i < BufferSize; i += 2) {
        let key = buffer[i], val = buffer[i+1];
        if (val > 0) { keys[i] = key; keys[i+1] = Math.min(val, 255); written++; }
        else { return { total: written, keys }; }
      }
    }
    return { total: written, keys };
  }
}

module.exports = { AnalogController, Keys };
