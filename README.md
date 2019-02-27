# SDK for controlling Wooting One and Two keyboards.

## Usage example:

`const { Keyboard } = require('wooting-sdk');`

## Enumerate USB devices and find+return the first One/Two found
let kb = Keyboard.get();

## Internal setup
`kb.init();`

## Get the version number of the installed firmware
`kb.getFirmwareVersion();`

# Analog

## Read the analog value of the G key
`kb.analog.readKey(Keyboard.Analog.G);`
Other keys can be found in analog.js (note that this mapping assumes QWERTY layout)

## Read the analog value of a row/column
`kb.analog.readLoc(row, column);`

# LEDs

## Select a mode. Defaults to Array. Possible modes: Direct, Array, Profile
`kb.leds.mode = Keyboard.Modes.Direct;`

## Initialize the LED controller
`kb.leds.init();`

## Set the L key to white
`kb.leds.setKey(Keyboard.LEDs.L, 255, 255, 255);`
Other keys can be found in leds.js (note that this mapping assumes QWERTY layout)

## Update the keyboard LED state
`kb.leds.updateKeyboard();`

Or optionally, enable auto-update so that setKey et al calls updateKeyboard for you
`kb.leds.autoUpd = true;`

## Set a row/column
`kb.leds.setLoc(row, column, r, g, b);`

## Reset the L key
`kb.leds.resetKey(Keyboard.LEDs.L);`

## Reset a row/column
`kb.leds.resetLoc(row, column);`

## Set the keyboard brightness. Ranges 0 to 255.  
Note that it only works if mode is Profile or before leds.init() is called or after leds.reset() is called, as Direct/Array enable the SDK and this blocks the call that sets brightness.
`kb.leds.setBrightness(level);`

## Reset the LED state in the keyboard
`leds.reset();`

## Disconnect from the keyboard (automatically calls leds.reset())
`kb.disconnect();`


# Other functions of interest:

## Informational:
```
kb.getSerialNumber(): Reads the full serial number info into kb.sn as an object. The string version prints the same format as the Wootility displays.
kb.getDeviceConfig(): Reads the device configuration (default profiles, tachyon mode, layout, etc). Saves as kb.deviceConfig. For fnKey and modeKey, they'll be in the format { analog: code, led: code }.
leds.getCurrentProfile(): Returns the index of the currently in-use profile. Ranges 0 to 3.
leds.loadCurrentProfile(set = true): Reads the currently in-use profile and saves it as leds.profile. If set is true, it copies the profile color map into the internal buffers.
leds.loadProfile(n = 0, set = true): Returns a specific profile.
```

## Direct mode:
```
leds.directSetLoc(row, col, r, g, b)
leds.directSetKey(keyCode, r, g, b)
leds.directResetLoc(row, col)
leds.directResetKey(keyCode)
```

## Array mode:
```
leds.arrayUpdateKeyboard(): Pushes the internal Array buffer to the keyboard.
These 6 update the internal buffers but do not push to the keyboard.
leds.arrayChangeLoc(row, col, r, g, b)
leds.arrayChangeKey(keyCode, r, g, b)
leds.arrayChangeResetLoc(row, col)
leds.arrayChangeResetKey(keyCode): These Reset functions use the color mapped to the key from leds.profile.map.
leds.arrayChangeColormap(map): Copies map into the internal Array buffer. Map is an array of Key0R, Key0G, Key0B, Key1R, ...
leds.arrayChangeColormapArray(arr): Copies arr into the internal Array buffer. Works the way wooting_rgb_array_set_full does.
These 6 call the 6 above, and auto-update the keyboard if enabled.
leds.arraySetLoc(row, col, r, g, b)
leds.arraySetKey(keyCode, r, g, b)
leds.arrayResetLoc(row, col)
leds.arrayResetKey(keyCode)
leds.arraySetColormap(map)
leds.arraySetColormapArray(arr)
```

## Profile mode:
```
leds.profileUpdateKeyboard(): Pushes the internal Profile buffer to the keyboard. This is a different one than what is stored in leds.profile.
The following are identical in behavor to their Array mode counterparts.
leds.profileChangeLoc(row, col, r, g, b)
leds.profileChangeKey(keyCode, r, g, b)
leds.profileChangeResetLoc(row, loc)
leds.profileChangeResetKey(keyCode)
leds.profileChangeColormap(map)
leds.profileSetLoc(row, col, r, g, b)
leds.profileSetKey(keyCode, r, g, b)
leds.profileResetLoc(row, col)
leds.profileResetKey(keyCode)
leds.profileSetColormap(map)
```

## Analog:
```
analog.autoUpd: Setting to true will start a 5ms loop auto-updating internal buffers. This changes the readKey, readLoc, and readFull behavior to only use the internal buffer rather than calling refreshBuffer(). Setting to false stops this loop.
analog.readFull: Returns an object in the format { total: keysRead, keys: [ Key0Code, Key0Level, Key1Code, ... ] }.
analog.getFull: Queries the keyboard for the analog state of (mostly) all keys. For the One, it returns the analog values for keys 0 through 86 (ANSI) or 87 (ISO). For the Two, it returns the values for keys 0 through 110. This does NOT update the internal buffers and is mostly useful for debugging.
```

