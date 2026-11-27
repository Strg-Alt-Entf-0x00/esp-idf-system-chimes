// Project File Actions
    // Export & Import JSON
    document.getElementById("btnExport").addEventListener("click", () => {
      const waveNames = ["SINE", "SQUARE", "TRIANGLE", "SAWTOOTH", "NOISE"];
      const obj = {
        project: {
          version: "2.1.0",
          name: document.getElementById("txtProjectName").value,
          slot_id: document.getElementById("txtSlotId").value.toUpperCase(),
          total_duration_ms: project.totalDurationMs,
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        },
        global: {
          master_volume: project.master_volume,
          bpm: project.bpm,
          snap_enabled: project.snap_ms > 0,
          grid_resolution_ms: project.snap_ms
        },
        layers: project.layers.map(l => ({
          layer_id: l.layer_id,
          name: l.name,
          waveform: waveNames[l.waveform],
          volume: l.volume,
          mute: l.mute,
          solo: l.solo,
          default_adsr: {
            attack_ms: l.adsr.attack_ms,
            decay_ms: l.adsr.decay_ms,
            sustain: l.adsr.sustain,
            release_ms: l.adsr.release_ms
          },
          notes: l.notes.map(n => ({
            id: n.id,
            frequency_hz: n.frequency_hz,
            start_time_ms: n.start_time_ms,
            duration_ms: n.duration_ms,
            adsr: l.adsr
          }))
        }))
      };

      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (obj.project.slot_id.toLowerCase() || "chime") + ".chime.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById("btnImport").addEventListener("click", () => {
      document.getElementById("fileInput").click();
    });

    document.getElementById("fileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          loadProjectFromObject(data);
        } catch(err) {
          alert("Error parsing JSON project: " + err.message);
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("btnNew").addEventListener("click", () => {
      if (confirm("Reset current project and start fresh?")) {
        project.layers = [{
          layer_id: 1,
          name: "Layer 01",
          waveform: 0,
          volume: 0.8,
          mute: false,
          solo: false,
          adsr: { attack_ms: 10, decay_ms: 50, sustain: 0.7, release_ms: 100 },
          notes: []
        }];
        project.activeLayerIndex = 0;
        project.selectedNote = null;
        document.getElementById("txtProjectName").value = "New Sound";
        document.getElementById("txtSlotId").value = "NEW_SLOT";
        updateLayersList();
        updateInspector();
        render();
      }
    });

    // Web Serial Communication Engine
    let serialPort = null;
    let serialReader = null;
    let serialWriter = null;
    let isConnected = false;
    let commandQueue = [];
    let isProcessingCommand = false;
    let lineBuffer = "";
