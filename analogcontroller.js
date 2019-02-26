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
    this._kb = undefined;
    this._autoUpd = false;
  }
  set kb(b) {
    if (!b.connected()) { throw new Error(`Keyboard isn't connected`); }
    this._kb = b;
    this.hdl = b.analoghdl;
  }
  get kb() { return this._kb; }
  set autoUpdate(v) { this._autoUpd = !!v; }
  get autoUpdate() { return this._autoUpd; }
  refreshBuffer() {
    let { kb, hdl } = this;
    if (!kb) { return false; }
    try {
      let b = [], { BufferSize } = Analog;
      while (b.length < BufferSize) { b = [...b, ...hdl.readSync()]; }
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
    if (!this.refreshBuffer()) { return 0; }
    for (let i = 1; (i < BufferSize) && (buffer[i] > 0); i += 2) {
      if (buffer[i-1] == keyCode) { return buffer[i]>255?255:buffer[i]; }
    }
    return 0;
  }
  readFull() {
    let { BufferSize } = Analog, keys = new Array(BufferSize), written = 0;
    if (!this.refreshBuffer()) { return undefined; }
    let { buffer } = this;
    for (let i = 0; i < BufferSize; i += 2) {
      let key = buffer[i], val = bufer[i+1];
      if (val > 0) { keys[i] = key; keys[i+1] = val>255?255:val; written++; }
      else { return { total: written, keys }; }
    }
    return { total: written, keys };
  }
}

module.exports = { AnalogController, Keys };
