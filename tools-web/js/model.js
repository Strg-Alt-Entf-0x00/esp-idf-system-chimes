function midiToFreq(midi) {
      return 440.0 * Math.pow(2.0, (midi - 69) / 12.0);
    }

    function freqToMidi(freq) {
      return Math.round(69 + 12 * Math.log2(freq / 440.0));
    }

    function midiToName(midi) {
      const octave = Math.floor(midi / 12) - 1;
      const noteName = PITCH_NAMES[midi % 12];
      return noteName + octave;
    }

    function isBlackKey(midi) {
      const pc = midi % 12;
      return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
    }

    // State Model
    class ProjectState {
      constructor() {
        this.name = "Boot Success";
        this.slot_id = "BOOT_SUCCESS";
        this.master_volume = 0.8;
        this.bpm = 120;
        this.snap_ms = 25;
        this.layers = [
          {
            layer_id: 1,
            name: "Melody 01",
            waveform: 2, // Triangle
            volume: 0.8,
            mute: false,
            solo: false,
            adsr: { attack_ms: 10, decay_ms: 50, sustain: 0.7, release_ms: 100 },
            notes: [
              { id: "n1", frequency_hz: midiToFreq(60), start_time_ms: 0, duration_ms: 150 },
              { id: "n2", frequency_hz: midiToFreq(64), start_time_ms: 150, duration_ms: 150 },
              { id: "n3", frequency_hz: midiToFreq(67), start_time_ms: 300, duration_ms: 350 }
            ]
          }
        ];
        this.activeLayerIndex = 0;
        this.selectedNote = null;
      }

      get totalDurationMs() {
        let maxMs = 0;
        for (const layer of this.layers) {
          for (const n of layer.notes) {
            maxMs = Math.max(maxMs, n.start_time_ms + n.duration_ms);
          }
        }
        return Math.max(500, maxMs);
      }

      get totalNotesCount() {
        return this.layers.reduce((acc, l) => acc + l.notes.length, 0);
      }
    }

    const project = new ProjectState();

    // Piano Roll Canvas View State
    const view = {
      keyWidth: 54,
      rulerHeight: 26,
      rowHeight: 18,
      pixelsPerMs: 0.35, // 1000ms = 350px
      scrollX: 0,        // in ms
      scrollY: (MAX_MIDI - 72) * 18, // centered around C4
      isDragging: false,
      isResizing: false,
      dragTarget: null,
      dragStartX: 0,
      dragStartY: 0,
      origStartMs: 0,
      origDurationMs: 0,
      origMidi: 60,
      playheadMs: 0,
      isPlaying: false
    };
