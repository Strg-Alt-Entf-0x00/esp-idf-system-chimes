# ESP-IDF System Chimes

ESP-IDF System Chimes is an ESP-IDF component for defining, storing, and
synthesizing short, user-configurable sounds on supported Espressif
microcontrollers. Sounds are stored in NVS and consist of note sequences,
waveforms, and ADSR envelopes. An optional Python desktop application provides
a piano-roll editor and communicates with firmware over a line-oriented serial
protocol.

The component renders mono signed 16-bit PCM samples. It does not configure an
I2S peripheral, codec, DAC, amplifier, or speaker; the application integrates
the renderer with its own audio output.

## Project status

- Component manifest version: `2.0.0`.
- ESP-IDF dependency: `>=5.3`.
- Manifest targets: `esp32`, `esp32s3`, and `esp32p4`.
- The repository includes a Waveshare ESP32-P4 development-console example
  using an ES8311 codec.
- Python GUI tests can be run locally. A passing host test suite does not verify
  a firmware build, flash, serial connection, or audible hardware output.
- Hardware validation must be performed on the exact board, ESP-IDF version,
  and audio path used by the application.

## Features

- Firmware-defined sound slots persisted as compact, versioned data in the
  dedicated `chimes_v1` NVS namespace.
- Sine, square, triangle, sawtooth, and noise waveforms.
- Per-layer volume and ADSR envelope, with timed notes of different pitches.
- Caller-controlled PCM rendering for integration with an application audio
  driver.
- Optional serial commands for querying, uploading, reading, deleting, and
  auditioning stored sounds.
- Standalone zero-install Web Serial Studio in `tools-web/index.html`
  with interactive Piano Roll, Web Audio PC preview, 12 bundled sound presets,
  1-click C code generator, and direct ESP32 hardware audition.
- Optional PyQt6 piano-roll editor with local PC preview, project JSON
  import/export, and serial device control.

## Limits and behavior

Firmware currently supports:

- Up to 64 registered sound slots.
- Slot IDs of 1-15 ASCII letters, digits, or underscores.
- Up to 8 layers per sound.
- Up to 32 notes per layer.
- Frequencies from 20 Hz through 20 kHz, further limited by the Nyquist
  frequency of the configured sample rate.
- 16-bit PCM output at the sample rate selected by the application.

The GUI is layer-free: each note can have its own waveform, volume, and ADSR
settings. On export to firmware, notes with matching waveform and ADSR settings
are grouped into layers. A project that groups into more than 8 layers or has
more than 32 notes in any layer cannot be uploaded.

The GUI limits timeline positions to 268,435 ms, a limit based on 32-bit sample
positioning at 16 kHz. Firmware also checks the configured sample rate when
creating a renderer; the maximum renderable duration in samples therefore
depends on that rate. Use a sample rate consistent with the audio output.

The desktop application imports and exports `.chime.json` note projects. It
does not import WAV files or upload recorded audio samples. PC preview
synthesizes the notes locally; device playback uses the sound stored in the
selected ESP32 slot.

## Add the component to an ESP-IDF project

For local development, place this repository in the consuming project's
`components/esp-idf-system-chimes` directory. The component manifest declares
the ESP-IDF and cJSON dependencies; use the ESP-IDF Component Manager when
resolving project dependencies.

The application component should depend on `esp-idf-system-chimes` and include
the public header:

```c
#include "system_chimes.h"
```

The root `CMakeLists.txt` registers `src/system_chimes.c`,
`src/chime_synth.c`, `src/chime_nvs.c`, and `src/chime_protocol.c`. It publicly
requires `esp_timer` and `nvs_flash`, and privately requires `cjson` and
FreeRTOS.

## Minimal API example

Initialize the component and register the slots used by the application. Check
every return value in production firmware:

```c
#include "system_chimes.h"

static void init_chimes(void)
{
    chime_config_t config;
    chime_get_default_config(&config);

    /* Match this to the rate configured for the application's audio output. */
    config.sample_rate = 16000;
    config.master_volume = 0.7f;

    /* The application initializes its NVS partition before chime_init(). */
    ESP_ERROR_CHECK(chime_init(&config));
    ESP_ERROR_CHECK(chime_register_slot("BOOT_SUCCESS"));
    ESP_ERROR_CHECK(chime_register_slot("ERROR_WARNING"));
}
```

To render a registered sound, call `chime_play()` and repeatedly call
`chime_render()` from the application's audio task. Send the rendered samples
to the application's output driver and call `chime_stop()` when finished or
cancelled. Do not run a blocking render loop in a latency-sensitive task.

```c
chime_handle_t handle = NULL;
int16_t pcm[256];
size_t samples_rendered = 0;

esp_err_t err = chime_play("BOOT_SUCCESS", &handle);
if (err == ESP_OK) {
    while (!chime_is_finished(handle)) {
        err = chime_render(handle, pcm, 256, &samples_rendered);
        if (err != ESP_OK) {
            break;
        }
        if (samples_rendered > 0) {
            /* Write pcm[0..samples_rendered) to the application audio driver. */
        }
    }
    ESP_ERROR_CHECK(chime_stop(handle));
}
```

The output-driver write is intentionally application-specific. See the P4
example for an I2S and ES8311 integration.

## ESP32-P4 development-console example

The example at
[`examples/ws-esp32-p4-console-chimes-dev/`](examples/ws-esp32-p4-console-chimes-dev/)
targets the Waveshare ESP32-P4-WIFI6 board with an ES8311 codec. It registers
10 slots and exposes the serial protocol for the desktop tool.

Requirements include an ESP-IDF installation compatible with the example's
dependencies, the target board, and the required audio hardware. From the
example directory, build with:

```console
idf.py build
```

Select the serial port in ESP-IDF before flashing. To flash and monitor:

```console
idf.py -p PORT flash monitor
```

Replace `PORT` with the device's serial port. A firmware build alone does not
verify that the board's codec, speaker, or physical audio path works.

The example's `sdkconfig.defaults` selects 16 kHz through
`CONFIG_CHIMES_DEFAULT_SAMPLE_RATE`. The example uses that Kconfig value for
both the renderer and I2S/codec configuration. When changing the sample rate,
keep the renderer and the application's audio driver on the same setting.

For board-specific pin assignments, setup, and serial usage, see the
[example README](examples/ws-esp32-p4-console-chimes-dev/README.md).

## Web Studio and Presets

Launch the standalone studio by opening [tools-web/index.html](tools-web/index.html) in Google Chrome or Microsoft Edge.

The editor supports note placement, selection, movement, resizing, overlapping
notes, and scrolling/zooming the piano roll. PC preview synthesizes the current
draft locally using the Web Audio API. Presets can be selected directly from the
built-in library dropdown, or imported from the [`presets/`](presets/) directory.
Uploading stores the current sound in the selected ESP32 slot over Web Serial, and
device playback auditions the stored sound through the board's speaker.

## Serial protocol

The example firmware uses newline-terminated commands and returns one
newline-terminated response per command:

| Command | Purpose |
|---|---|
| `TOOL_ID` | Return the firmware tool identifier. |
| `QUERY_SLOTS` | Return registered slots and their stored sound durations. |
| `GET_SLOT <slot_id>` | Return the stored sound definition as JSON. |
| `UPLOAD <slot_id> <json>` | Validate and store a sound in NVS. |
| `DELETE <slot_id>` | Delete one sound from NVS. |
| `ERASE_ALL` | Delete all sounds in the `chimes_v1` NVS namespace only. |
| `PLAY <slot_id>` | Start protocol-managed playback. |
| `PLAY_STATUS` | Report whether protocol-managed playback is active. |
| `STOP` | Stop protocol-managed playback. |
| `SET_VOLUME <0.0-1.0>` | Set the runtime master volume. |
| `GET_VOLUME` | Read the runtime master volume. |

`ERASE_ALL` does not erase the entire NVS partition or other NVS namespaces.
Flashing or erasing an entire device is a separate operation and may remove
application data.

The protocol handler's `PLAY` command is for the example's integrated playback
task. Applications using the component API directly should manage rendering
and output through their own audio task.

## System Chimes Studio

Open [tools-web/index.html](./tools-web/index.html) in Google Chrome or Microsoft Edge.

- **Zero Install:** Modular local HTML, CSS, and JavaScript files with no Python, dependencies, or local web server needed.
- **Piano Roll:** Interactive canvas editor supporting up to 8 layers, 32 notes per layer, and 5 waveforms (Sine, Square, Triangle, Sawtooth, Noise).
- **Web Audio Engine:** Real-time synthesis preview on PC with per-layer ADSR envelope curves and polyphonic playback.
- **12 Bundled Sound Presets:** Instant selection of ready-to-use system chimes (boot, low battery, network state, wake alarm, etc.).
- **Hardware Integration:** Connect directly to ESP32 over Web Serial at 115200 baud to query slots, upload chimes into NVS, audition playback on speaker, and manage volume.
- **Project Files:** Import and export editable chime projects as JSON.

## Tests

### Automated Web Studio tests

Run the validation suite for the browser Studio and its local assets:

```powershell
python tests/test_web_chimes_studio.py
```

### ESP-IDF component tests

The `tests/target/` directory is a separate ESP-IDF Unity test application. Configure
ESP-IDF for the ESP32-P4 target and build it from that directory:

```console
cd tests/target
idf.py build
```

To execute device tests, flash the test application to a dedicated test board
and monitor its output. This is a test firmware, not the development-console
application. The tests use NVS and may erase the test device's NVS when
initializing after an incompatible or damaged NVS layout. Do not run them on a
device containing data that must be preserved.

A passing host test suite or a successful component build does not by itself
confirm physical audio output or board compatibility.

## Storage and recovery

Each saved sound is encoded as a compact, versioned binary blob in the
`chimes_v1` namespace, keyed by slot ID. Only active layers and notes are
stored; unused fixed-capacity array elements do not consume NVS space. The
namespace version intentionally separates this format from earlier component
storage. `chime_delete_sound()` deletes a single sound;
`chime_erase_all_sounds()` removes sounds from this namespace while preserving
other namespaces. Avoid a full-chip erase unless all device data is intended
to be removed.

The component does not initialize, erase, or recover the application's NVS
partition. The application owns that lifecycle and must check
`nvs_flash_init_partition()` before `chime_init()`. Use
`chime_get_storage_info()` to inspect live free/available NVS entries and heap
capacity before a potentially large transfer. NVS statistics describe the
whole shared default partition, not just chime entries; storage writes still
report NVS errors if the current partition cannot fit a sound.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
- **Free for noncommercial use**: Personal, educational, research, and hobbyist projects are completely free.
- **Commercial use**: Not permitted without prior authorization. For commercial inquiries, please contact the author via GitHub.
