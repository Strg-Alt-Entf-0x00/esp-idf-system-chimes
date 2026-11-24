# ESP32-P4 Development Console

This example integrates the System Chimes component with the Waveshare
ESP32-P4-WIFI6 board, an ES8311 codec, I2S output, and the desktop serial
protocol.

## Hardware

- Board: Waveshare ESP32-P4-WIFI6
- Audio codec: ES8311
- Audio output: 3.5 mm jack and onboard speaker
- Default audio sample rate: 16 kHz, stereo I2S output

The board pin assignments are defined in `main/main.c`. This example renders
mono PCM in the component and duplicates each sample to the codec's stereo I2S
stream.

## Requirements

- ESP-IDF 5.3 or later, with ESP32-P4 support installed
- Waveshare ESP32-P4-WIFI6 board and USB-C cable
- Python 3 and the desktop tool dependencies for serial editing

## Build and flash

Run these commands from an ESP-IDF-enabled PowerShell or Command Prompt:

```powershell
cd examples\ws-esp32-p4-console-chimes-dev
idf.py build
idf.py -p COMx flash monitor
```

Replace `COMx` with the board's serial port. The project's `sdkconfig.defaults`
sets the P4 target and selects 16 kHz for both synthesis and I2S. The sample
rate can be changed through `CONFIG_CHIMES_DEFAULT_SAMPLE_RATE`; the example
uses the same setting for the renderer and codec.

The optional `esp-build.bat` wrapper also supports `build`, `flash`,
`flash-monitor`, `monitor`, and `clean` actions. Run `esp-build.bat help` for
its options. The wrapper's local settings are stored in
`esp-build-config.json`.

## Connect with the Web Studio

Open [tools-web/chimes_studio.html](../../tools-web/chimes_studio.html) in Google Chrome or Microsoft Edge.

Click **Connect ESP32**, select the board's serial port at 115200 baud, and connect. The firmware registers these initially empty sound slots:

| Slot | Intended event |
| --- | --- |
| `BOOT_SUCCESS` | Startup completed |
| `BOOT_ERROR` | Startup failed |
| `AUTH_ACCEPTED` | Authentication accepted |
| `AUTH_DENIED` | Authentication rejected |
| `ERROR_CRITICAL` | Critical fault |
| `ERROR_WARNING` | Warning |
| `SYSTEM_READY` | System ready |
| `NOTIFICATION` | General notification |
| `CONFIRM` | User action confirmed |
| `CANCEL` | User action cancelled |

The editor is layer-free: notes can have individual waveforms, volume, and
ADSR settings. Firmware storage groups notes with matching properties into
profiles; each sound supports up to 8 profiles with up to 32 notes per
profile. The desktop tool imports and exports `.chime.json` projects; it does
not upload WAV recordings.

## Playback and audio verification

Save a sound to a registered slot, then use the device playback control in the
desktop tool. The serial protocol also supports `PLAY <slot_id>` and `STOP`.
Connect a speaker or headphones to the board to verify audible output. Build
success, codec initialization, and I2S write logs do not establish the
physical output level or sound quality.

The component renders PCM but does not configure audio hardware. The example
owns the I2S and ES8311 setup and is specific to the listed board and pinout.
