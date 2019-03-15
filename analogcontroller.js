const Keys = require('./analog.js');

const scanIndexArray = [
  [ 0, Keys.None, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 107, 108, 109, 110 ],
  [ 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 61, 106, 105, 104, 103 ],
  [ 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 62, 102, 101, 100, 99 ],
  [ 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 45, 60, Keys.None, Keys.None, Keys.None, 98, 97, 96, Keys.None ],
  [ 64, 87, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, Keys.None, 75, Keys.None, 63, Keys.None, 90, 91, 92, 93 ],
  [ 80, 81, 82, Keys.None, Keys.None, Keys.None, 83, Keys.None, Keys.None, Keys.None, 84, 85, 86, 79, 76, 77, 78, Keys.None, 95, 94, Keys.None ]
];

const USB = {
  // queries
  GetAnalogValues: 20
};

const Analog = {
  Rows: 6,
  ColsOne: 17,
  ColsTwo: 21,
  BufferSize: 32
};
function analogHdl(data) {
  let { BufferSize } = Analog;
  let { buffer, allKeys } = this;
  allKeys.fill(0);
  for (let i = 0; i < BufferSize; i += 2) { allKeys[data[i]] = Math.min(data[i + 1], 255); }
}
class AnalogController {
  constructor() {
    this.buffer = [];
    this.allKeys = undefined;
    this._kb = undefined;
    this._autoUpd = false;
    this.boundf = undefined;
  }
  set kb(b) {
    if (!b.connected()) { throw new Error(`Keyboard isn't connected`); }
    if ((this.kb) && (this.boundf)) { this.kb.analoghdl.removeEventListener('data', this.boundf); }
    this._kb = b;
    this.hdl = b.analoghdl;
    this.allKeys = new Array(b.deviceConfig.isTwo ? 117 : 96);
    this.allKeys.fill(0);
    this.hdl.on('data', this.boundf = analogHdl.bind(this));
  }
  get kb() { return this._kb; }
  readLoc(row, col) { return this.readKey(this.getSafeAnalogIndex(row, col)); }
  readKey(keyCode) {
    let { kb, buffer } = this, { BufferSize } = Analog;
    if (!kb) { return 0; }
    else if (keyCode == Keys.None) { return 0; }
    else if ((kb.deviceConfig.isTwo) && (keyCode > 117)) { return 0; }
    else if ((!kb.deviceConfig.isTwo) && (keyCode > 96)) { return 0; }
    return this.allKeys[keyCode];
  }
  readFull() {
    let { BufferSize } = Analog, keys = new Array(BufferSize), written = 0;
    let { allKeys } = this, k = 0;
    for (let i = 0, l = allKeys.length; i < l; i++, k+=2) { if (allKeys[i] > 0) { keys[k] = i; keys[k + 1] = allKeys[i]; written++; } }
    return { total: written, keys };
  }
  getFull() {
    let { kb } = this, out = [], buffer;
    if (!kb) { return false; }
    if (!(buffer = kb.sendQuery(USB.GetAnalogValues))) { return undefined; }
    // inverted as the analog API is up 0, down 255, while internally it's up 255, down 0
    for (let i = 0, l = buffer.length; i < l; i++) { out[i] = 255-buffer[i]; }
    return out;
  }
  getSafeAnalogIndex(row, col) {
    let { kb } = this, { None } = Keys;
    if (!kb) { return None; }
    else if ((row < 0) || (col < 0)) { return None; }
    else if (row >= Analog.Rows) { return None; }
    else if ((!kb.deviceConfig.isTwo) && (col >= Analog.ColsOne)) { return None; }
    else if ((kb.deviceConfig.isTwo) && (col >= Analog.ColsTwo)) { return None; }
    return scanIndexArray[row][col];
  }
}

module.exports = { AnalogController, Keys, Analog, scanIndexArray };
