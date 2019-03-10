# SDK for controlling Wooting One and Two keyboards.

## Usage example:

`const { Keyboard } = require('wooting-sdk');`

## Enumerate USB devices and find+return the first One/Two found
`let kb = Keyboard.get();`

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
kb.getDeviceConfig(): Reads the device configuration (default profiles, tachyon mode, layout, etc). Saves as kb.deviceConfig. For fnKey and modeKey, they'll be in the format { analog: code, led: code }. This is automatically called as part of kb.init().
kb.getFnKeys(): Reads the mappings for the Fn key, media keys, brightness keys, and toggleable Windows key. Saves them as kb.fnKeys in the same way as getDeviceConfig(). This is automatically called as part of kb.init().
kb.getActuationPoint(): Returns the analog level equivalent to the actuation point set in the current profile. Saves it as kb.actuationPoint as well. This is automatically called as part of kb.init().
kb.getDigitalEnabled(n = 0): Returns if digital keys are enabled on the supplied profile. Saves it as kb.digitalEnabled. This is automatically called as part of kb.init().
kb.getCurrentProfile(): Returns the index of the currently in-use profile. Ranges 0 to 3.

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
analog.readFull: Returns an object in the format { total: keysRead, keys: [ Key0Code, Key0Level, Key1Code, ... ] }.
analog.getFull: Queries the keyboard for the analog state of (mostly) all keys. For the One, it returns the analog values for keys 0 through 86 (ANSI) or 87 (ISO). For the Two, it returns the values for keys 0 through 110 (ANSI) or 111 (ISO). This does NOT update the internal buffers and is mostly useful for debugging.
```

# Toolkit

Implements some convenience features.

## Usage
`const { Toolkit } = require('wooting-sdk/toolkit');`  

`let tk = new Toolkit();`  
Tell it what features to use (more info below)  
`tk.use(Toolkit.Features.All)`  
Must pass a fully initialized keyboard to it. This includes initializing the LEDs  
`tk.init(kb)`  
Finally, enable it  
`tk.enable(true/false)`  

## Features

Toolkit.Features.Locks:  
Handle caps lock, scroll lock, num lock, Windows key lock, and Fn lock combos and turn on/off their indicator colors. These can be changed via kb.leds.profile. At present, scroll lock, num lock, and Windows key lock default to the color assigned to caps lock in the profile as there are no settings for them yet.  
  
Toolkit.Features.Profile:  
Watch for and automatically load + use the new profile whenever the user changes it (for example via A1/A2/A3 on the Two, Fn+Left/Down/Right on the One, or Mode key)  
  
Toolkit.Features.ExitHandler:  
Recommended at the least. Sets up a simple Node process event handler for the exit event to call kb.disconnect(). This makes sure that the keyboard gets reset properly on process exit. Note that you may also need your own handler for SIGINT if you're using the console. See the examples for that.  
  
Toolkit.Features.Layer:  
Disables setting key colors based on locks from inside the Toolkit logic, relying instead on the lockLayer implemention.  

# Layers

Implements layers with alpha support.

## Usage
`const { Layer, Renderer } = require('wooting-sdk/layered');`  
`let renderer = new Renderer(kb);`  
Add a layer  
`renderer.addLayer(layer);`  
Start it up  
`renderer.init();`  

## Creating a custom layer
```
class customLayer extends Layer {
  tick() {}
  draw(map) { /* do extra stuff */ super.draw(map); }
}
```
The tick() and draw() functions are called every ~100ms.  
  
tick() is for any state/drawing logic you may need.  
draw(map) is optionally for drawing to the main map directly at any arbitrary location. You MUST call super.draw(map) from within if you decide to override.  
  
Setting a layer key's red, green, or blue to -1 sets that channel as transparent, so it has no effect on the map. Useful for blending.
Setting a layer key's alpha to -1 sets the entire key as transparent, so it has no effect on the map. No different to setting the alpha to 0, but short-circuits doing any of the blending math, and makes it more obvious what's going on.

## Functions
```
renderer.init(): Initialize the internal "precise" timer and start rendering.
renderer.stop(): Stop the internal timer.
renderer.addLayer(layer, ind = -1): Add a layer to the renderer, optionally at a specific index.
renderer.moveLayer(layer, ind = -1): Move the given layer.
renderer.remLayer(layer): Remove the layer.

layer.tick(): Called every ~100ms. All layers are tick()'d before the drawing stage.
layer.draw(map): Called every ~100ms. This does the blending logic between the layer's map and the renderer's map.
layer.setColormap(map): A special version of leds.setColormap that also copies an alpha channel.
layer.setColormapNoAlpha(map, alpha = 255): Copies a normal colormap (like to leds.setColormap) and uses the given alpha instead.
The following functions have the same use/signature as their leds counterparts:
layer.setLoc
layer.setKey
layer.resetLoc
layer.resetKey
```

# Included examples

## examples/clock.js
Uses rows 2 through 4 to display hour/minute/second.  
Pattern is left-to-right, with the following color meanings: blue is 10, green is 5, red is 1.  
So 37 is blue blue blue green red red.  

## examples/game.js
Simple side shooter using rows 2 through 4.  
Controls are up/down arrow to move, right arrow to fire.  
Unit HP is denoted by color: blue is 3, green is 2, red is 1.  
Their shots are yellow, yours are cyan.  
Uses row 1 to display score using the same number pattern as the clock with the addition of yellow as 50.  

## examples/monitor.js
Specific to Linux with an nVidia GPU, but still useful to look at.  
Uses rows 0 through 4.  
Row 0: Escape key shows GPU temperature, F1 shows CPU package temperature, F2 through however many cores show individual core temperatures.  
Row 1: Tilde shows average all-thread CPU load, 1 through however many threads (up to 12) show per-thread loads, and Backspace shows GPU load.  
Rows 2-4: Shows the same clock as from the clock example.  
When the screensaver turns on, it waits 5 seconds -> resets the LEDs -> does a "breathing"-like sleep mode where it fades down/up brightness between ~10 to roughly what your profile's brightness setting is in steps of 3. Once the screensaver exits and it's faded back up to the profile brightness, it resumes monitor mode.  

## examples/layers.js
Boring little demo of using layers and how to use the Toolkit with them.  
Does some blending of a couple random-ish layers on top of the profile's map, with the Toolkit's lock layer on top of it all.  
