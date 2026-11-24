# Changelog

Notable project changes are recorded here. This changelog describes repository
changes; it is not a guarantee of hardware validation.

## [Unreleased]

### Added

- Standalone zero-install Web Serial Studio (`tools-web/chimes_studio.html`)
  featuring an interactive HTML5 Canvas piano roll, Web Audio synthesis preview,
  12 bundled chime presets, 1-click C code generator, and direct hardware upload/audition.
- Automated validation suite in `tests/test_web_chimes_studio.py`.
- Editable sound projects for network state, low battery, thermal warnings,
  hourly clock cues, and a one-shot wake alarm.
- Automated validation that bundled sound projects import and fit the
  firmware's profile, note, duration, and slot constraints.
- A centralized Qt application palette and stylesheet, including shared
  tooltip and slider styling.

### Changed

- Store only active sound data in a versioned `chimes_v1` namespace, report
  live NVS/heap capacity, and leave NVS initialization and recovery to the
  consuming application.
- Require sounddevice 0.5.0 or newer; its Windows PortAudio binary avoids the
  ASIO initialization issue that can interrupt other applications' audio.
- The example defaults to 16 kHz, and its Kconfig sample-rate and volume
  settings now configure both synthesis and the example audio output.
- Updated the ESP32-P4 example instructions for the current layer-free editor,
  serial workflow, and board audio path.
- Documented that clock and alarm projects are finite cues; scheduling and
  repetition belong to the application using the component.

## [2.0.0] - 2026-11-06

### Added

- Dynamic sound-slot registration and NVS-backed storage.
- Sine, square, triangle, sawtooth, and noise synthesis with note timing,
  profiles, and ADSR envelopes.
- A line-oriented serial protocol for slot queries, sound transfer, volume,
  and example playback.
- A desktop piano-roll editor with project import/export, local preview, and
  serial device control.

### Changed

- Replaced the previous fixed sound definitions with user-defined slot IDs
  and editable sound data.
- The firmware renders PCM for an application's audio driver rather than
  configuring a codec or output peripheral itself.
