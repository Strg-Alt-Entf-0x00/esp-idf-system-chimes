let lastHardwareVolume = 0.8;
let hardwareVolumeKnown = false;
let hardwareVolumeMuted = false;
let lastMasterVolume = 0.8;
let masterVolumeMuted = false;

function setMasterVolume(volume) {
  project.master_volume = volume;
  document.getElementById("rngMasterVol").value = String(volume);
  document.getElementById("txtMasterVol").textContent = Math.round(volume * 100) + "%";
  masterVolumeMuted = volume === 0;
  if (volume > 0) lastMasterVolume = volume;
  applyPreviewMasterVolume(volume);

  const button = document.getElementById("btnMuteMasterVol");
  button.classList.toggle("muted", masterVolumeMuted);
  button.setAttribute("aria-pressed", String(masterVolumeMuted));
  button.setAttribute("aria-label", masterVolumeMuted ? "Unmute PC preview" : "Mute PC preview");
  button.dataset.tooltip = masterVolumeMuted ? "Unmute PC preview" : "Mute PC preview";
  document.getElementById("masterVolIconOn").classList.toggle("is-hidden", masterVolumeMuted);
  document.getElementById("masterVolIconMuted").classList.toggle("is-hidden", !masterVolumeMuted);
}

function updateHardwareMuteButton() {
  const button = document.getElementById("btnMuteHwVol");
  if (!button) return;
  button.disabled = !hardwareVolumeKnown;
  button.classList.toggle("muted", hardwareVolumeMuted);
  button.setAttribute("aria-pressed", String(hardwareVolumeMuted));
  button.setAttribute("aria-label", hardwareVolumeMuted ? "Unmute ESP32 output" : "Mute ESP32 output");
  button.dataset.tooltip = hardwareVolumeMuted ? "Unmute ESP32 output" : "Mute ESP32 output";
  document.getElementById("hwVolIconOn").classList.toggle("is-hidden", hardwareVolumeMuted);
  document.getElementById("hwVolIconMuted").classList.toggle("is-hidden", !hardwareVolumeMuted);
}

function displayHardwareVolume(volume) {
  const slider = document.getElementById("rngHwVol");
  slider.value = String(volume);
  slider.disabled = false;
  document.getElementById("txtHwVol").textContent = Math.round(volume * 100) + "%";
  hardwareVolumeKnown = true;
  hardwareVolumeMuted = volume === 0;
  if (volume > 0) lastHardwareVolume = volume;
  updateHardwareMuteButton();
}

function markHardwareVolumeUnavailable() {
  hardwareVolumeKnown = false;
  hardwareVolumeMuted = false;
  lastHardwareVolume = 0.8;
  document.getElementById("rngHwVol").disabled = true;
  document.getElementById("txtHwVol").textContent = "-";
  updateHardwareMuteButton();
}

function setUnqueriedHardwareState(message) {
  const count = document.getElementById("slotCountBadge");
  const slots = document.getElementById("slotListContainer");
  if (count) {
    count.textContent = message === "probing" ? "Waiting" : "Not queried";
    count.style.color = "var(--text-muted)";
  }
  if (slots) {
    slots.textContent = message === "probing"
      ? "Waiting for firmware verification before querying hardware."
      : "Connect ESP32 & query slots to read onboard sounds.";
    slots.style.color = "var(--text-muted)";
    slots.style.fontSize = "11px";
    slots.style.textAlign = "center";
    slots.style.padding = "12px";
  }
  markHardwareVolumeUnavailable();
}

function setConnectionState(state, info) {
      const b = document.getElementById("statusBadge");
      const txt = document.getElementById("badgeText");
      const btn = document.getElementById("btnConnect");
      const hardwareControls = document.querySelectorAll("#tabHw button");
      const uploadModalBtn = document.getElementById("btnUploadSlotModal");
      const eraseAllBtn = document.getElementById("btnEraseAll");
      if (btn) btn.classList.remove("connected", "connecting", "unrecognized");
      if (b) b.className = "status-badge";
      hardwareControls.forEach((control) => {
        control.disabled = state !== "connected";
      });
      if (uploadModalBtn) uploadModalBtn.disabled = state !== "connected";
      if (eraseAllBtn) eraseAllBtn.disabled = state !== "connected";

      if (state === "connected") {
        isConnected = true;
        isFirmwareVerified = true;
        window.isConnected = true;
        window.isFirmwareVerified = true;
        if (btnTargetEsp) {
          btnTargetEsp.disabled = false;
          btnTargetEsp.dataset.tooltip = "Play audio through ESP32 onboard speaker";
        }
        if (b) b.className = "status-badge online";
        if (txt) txt.textContent = info || "Chimes Online";
        if (btn) {
          btn.classList.add("connected");
      btn.dataset.tooltip = `Verified: ESP32 System Chimes (${info || "Online"}) - Click to Disconnect`;
      btn.setAttribute("aria-label", "Disconnect from ESP32 System Chimes");
      btn.setAttribute("aria-pressed", "true");
        }
      } else if (state === "probing") {
        isConnected = true;
        isFirmwareVerified = false;
        if (b) b.className = "status-badge probing";
        if (txt) txt.textContent = "Probing Firmware...";
        if (btn) {
          btn.classList.add("connecting");
      btn.dataset.tooltip = "Probing target device for ESP32 Chimes firmware...";
      btn.setAttribute("aria-label", "Cancel ESP32 serial connection");
      btn.setAttribute("aria-pressed", "true");
        }
      } else if (state === "unrecognized") {
        isConnected = true;
        isFirmwareVerified = false;
        if (b) b.className = "status-badge unrecognized";
        if (txt) txt.textContent = "Unverified Device";
        if (btn) {
          btn.classList.add("unrecognized");
      btn.dataset.tooltip = "Unverified device: no Chimes firmware signature received";
      btn.setAttribute("aria-label", "Disconnect unverified serial device");
      btn.setAttribute("aria-pressed", "true");
        }
      } else {
        // Disconnected
        isConnected = false;
        isFirmwareVerified = false;
        window.isConnected = false;
        window.isFirmwareVerified = false;
        if (btnTargetEsp) {
          btnTargetEsp.disabled = true;
          btnTargetEsp.dataset.tooltip = "Connect ESP32 hardware to enable speaker output";
        }
        if (playbackTarget === "esp") {
          setPlaybackTarget("pc");
        }
        if (b) b.className = "status-badge";
        if (txt) txt.textContent = "Disconnected";
    if (btn) {
      btn.dataset.tooltip = "Connect ESP32 (115200 baud)";
      btn.setAttribute("aria-label", "Connect to ESP32 System Chimes");
      btn.setAttribute("aria-pressed", "false");
    }
      }
  if (state !== "connected") setUnqueriedHardwareState(state);
    }

    function updateBadge(online, text) {
      if (online) {
        setConnectionState("connected", text);
      } else {
        setConnectionState("disconnected", text);
      }
    }

    function sendSerialCommand(cmd, allowUnverified = false) {
      if (!serialWriter) {
        return Promise.reject(new Error("Serial port is not connected."));
      }
      if (!allowUnverified && !isFirmwareVerified) {
        return Promise.reject(new Error("ESP32 System Chimes firmware has not been verified."));
      }
      return new Promise((resolve, reject) => {
        commandQueue.push({ cmd, resolve, reject });
        processCommandQueue();
      });
    }

    async function processCommandQueue() {
      if (isProcessingCommand || commandQueue.length === 0 || !serialWriter) return;
      isProcessingCommand = true;
      const { cmd, resolve, reject } = commandQueue.shift();

      try {
        logTerminal("TX >> " + cmd, "tx");
        const encoder = new TextEncoder();
        await serialWriter.write(encoder.encode(cmd + "\n"));

        // Wait for response line
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for response to: " + cmd));
          isProcessingCommand = false;
          processCommandQueue();
        }, 4000);

        window._pendingCmdResolve = (res) => {
          clearTimeout(timeout);
          resolve(res);
          isProcessingCommand = false;
          processCommandQueue();
        };
        window._pendingCmdReject = (err) => {
          clearTimeout(timeout);
          reject(err);
          isProcessingCommand = false;
          processCommandQueue();
        };
      } catch(err) {
        logTerminal("Write Error: " + err.message, "err");
        reject(err);
        isProcessingCommand = false;
        processCommandQueue();
      }
    }

    async function connectSerial() {
      if (isConnected) {
        disconnectSerial();
        return;
      }

      if (!("serial" in navigator)) {
        alert("Web Serial API is not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });
        serialWriter = serialPort.writable.getWriter();
        isConnected = true;
        isFirmwareVerified = false;
        setConnectionState("probing");
        toggleTerminal(true);
        logTerminal("Serial port opened at 115200 baud. Probing for ESP32 Chimes firmware...", "info");

        readSerialLoop();

        // 3.0s handshake timeout
        if (handshakeTimeout) clearTimeout(handshakeTimeout);
        handshakeTimeout = setTimeout(() => {
          if (isConnected && !isFirmwareVerified) {
            setConnectionState("unrecognized");
            logTerminal("[WARN] Probe timeout: Target device did not respond with Chimes signatures.", "err");
            logTerminal("[HINT] Flash 'examples/ws-esp32-p4-wifi6-system-chimes-dev' to your board.", "info");
          }
        }, 3000);

        // Send Handshake
        try {
          const idRes = await sendSerialCommand("TOOL_ID", true);
          if (idRes && (idRes.includes("ESP32_SYSTEM_CHIMES_V2") || idRes.includes("ESP32_SYSTEM_CHIMES") || idRes.includes("CHIMES"))) {
            if (handshakeTimeout) {
              clearTimeout(handshakeTimeout);
              handshakeTimeout = null;
            }
            setConnectionState("connected", idRes.includes("V2") ? "V2 Hardware Online" : "Chimes Online");
            logTerminal("Handshake verified: " + idRes, "rx");
            await querySlots();
            await readHwVolume();
            const activeSlot = cachedSlots.find(s => s.slot_id === project.slot_id && s.has_sound) || cachedSlots.find(s => s.has_sound);
            if (activeSlot) {
              logTerminal(`Auto-loading hardware sound from slot "${activeSlot.slot_id}"...`, "info");
              await downloadSlot(activeSlot.slot_id);
            }
          } else {
            setConnectionState("unrecognized");
            logTerminal("Unrecognized response: " + idRes, "err");
          }
        } catch (e) {
          if (isConnected && !isFirmwareVerified) {
            setConnectionState("unrecognized");
            logTerminal("Handshake probe did not respond: " + e.message, "err");
          }
        }
      } catch(err) {
        logTerminal("Connection failed: " + err.message, "err");
        await disconnectSerial();
      }
    }

    async function disconnectSerial() {
      if (handshakeTimeout) {
        clearTimeout(handshakeTimeout);
        handshakeTimeout = null;
      }
      isConnected = false;
      isFirmwareVerified = false;
      const queuedCommands = commandQueue.splice(0);
      const pendingReject = window._pendingCmdReject;
      window._pendingCmdResolve = null;
      window._pendingCmdReject = null;
      const disconnectError = new Error("Serial connection closed before command completed.");
      if (pendingReject) pendingReject(disconnectError);
      queuedCommands.forEach(({ reject }) => reject(disconnectError));
      if (serialReader) {
        try {
          await serialReader.cancel();
        } catch(error) {
          logTerminal("Could not stop serial reader: " + error.message, "err");
        }
        serialReader = null;
      }
      if (serialWriter) {
        try {
          await serialWriter.close();
        } catch(error) {
          logTerminal("Could not close serial writer: " + error.message, "err");
        }
        serialWriter = null;
      }
      if (serialPort) {
        try {
          await serialPort.close();
        } catch(error) {
          logTerminal("Could not close serial port: " + error.message, "err");
        }
        serialPort = null;
      }
      setConnectionState("disconnected");
      cachedSlots = [];
      if (typeof window.updatePresetsDropdown === "function") {
        window.updatePresetsDropdown([]);
      }
      logTerminal("Serial port disconnected.", "info");
    }
    document.getElementById("btnConnect").addEventListener("click", connectSerial);

    async function readSerialLoop() {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
      serialReader = textDecoder.readable.getReader();

      try {
        while (isConnected) {
          const { value, done } = await serialReader.read();
          if (done) break;
          if (value) {
            lineBuffer += value;
            let lines = lineBuffer.split(/\r?\n/);
            lineBuffer = lines.pop(); // keep last incomplete chunk

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              logTerminal("RX << " + trimmed, "rx");

              if (window._pendingCmdResolve) {
                if (trimmed.startsWith("OK") || trimmed.startsWith("ERROR:")) {
                  const res = trimmed;
                  const cb = window._pendingCmdResolve;
                  window._pendingCmdResolve = null;
                  window._pendingCmdReject = null;
                  cb(res);
                }
              }
            }
          }
        }
      } catch(err) {
        if (isConnected) logTerminal("Reader loop terminated: " + err.message, "err");
      }
    }

    let cachedSlots = [];

    // Query Slots Command
    async function querySlots() {
      const count = document.getElementById("slotCountBadge");
      const container = document.getElementById("slotListContainer");
      if (count) {
        count.textContent = "Querying";
        count.style.color = "var(--text-muted)";
      }
      if (container) container.textContent = "Querying device slots...";
      try {
        const res = await sendSerialCommand("QUERY_SLOTS");
        if (res.startsWith("OK: ")) {
          const jsonStr = res.slice(4);
          const data = JSON.parse(jsonStr);
          cachedSlots = data.slots || [];
          renderSlotsList(cachedSlots);
          if (typeof window.updatePresetsDropdown === "function") {
            window.updatePresetsDropdown(cachedSlots);
          }
        } else {
          throw new Error(res);
        }
      } catch(error) {
        if (count) {
          count.textContent = "Unavailable";
          count.style.color = "var(--text-muted)";
        }
        if (container) container.textContent = "Could not read device slots.";
        logTerminal("Query slots failed: " + error.message, "err");
      }
    }
    document.getElementById("btnQuerySlots").addEventListener("click", querySlots);

    function renderSlotsList(slots) {
      const container = document.getElementById("slotListContainer");
      container.innerHTML = "";
      document.getElementById("slotCountBadge").textContent = slots.length + " slots";
      document.getElementById("slotCountBadge").style.color = "var(--accent-emerald)";

      if (slots.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); font-size:11px; padding:10px; text-align:center;">No slots registered.</div>`;
        return;
      }

      slots.forEach(slot => {
        const row = document.createElement("div");
        row.className = "slot-row";
        row.innerHTML = `
          <div>
            <strong style="color: ${slot.has_sound ? 'var(--accent-mint)' : 'var(--text-muted)'};">${slot.slot_id}</strong>
            <span style="font-size:10px; color:var(--text-dim); margin-left:6px;">${slot.has_sound ? slot.duration_ms + 'ms' : '(Empty)'}</span>
          </div>
          <div style="display:flex; gap:4px;">
            ${slot.has_sound ? `<button class="btn btn-sm" data-play="${slot.slot_id}" title="Play">▶</button>` : ''}
            <button class="btn btn-sm" data-get="${slot.slot_id}" title="Download to Editor">⬇</button>
            <button class="btn btn-sm btn-danger" data-del="${slot.slot_id}" title="Delete Sound">✕</button>
          </div>
        `;

        const playBtn = row.querySelector('[data-play]');
        if (playBtn) playBtn.addEventListener("click", () => {
          sendSerialCommand("PLAY " + slot.slot_id).catch((error) => {
            logTerminal("Device playback failed: " + error.message, "err");
          });
        });

        const getBtn = row.querySelector('[data-get]');
        if (getBtn) getBtn.addEventListener("click", () => downloadSlot(slot.slot_id));

        const delBtn = row.querySelector('[data-del]');
        if (delBtn) delBtn.addEventListener("click", async () => {
          if (confirm(`Delete sound in slot ${slot.slot_id}?`)) {
            try {
              await sendSerialCommand("DELETE " + slot.slot_id);
              querySlots();
            } catch(error) {
              logTerminal("Delete sound failed: " + error.message, "err");
            }
          }
        });

        container.appendChild(row);
      });
    }

    // Download slot definition to editor
    async function downloadSlot(slotId) {
      try {
        const res = await sendSerialCommand("GET_SLOT " + slotId);
        if (res.startsWith("OK: ")) {
          const soundData = JSON.parse(res.slice(4));
          // Transform firmware format to editor project format
          const newProj = {
            project: {
              name: slotId.replace(/_/g, " "),
              slot_id: slotId,
              total_duration_ms: soundData.total_duration_ms
            },
            global: { master_volume: 0.8, bpm: 120, grid_resolution_ms: 25 },
            layers: soundData.layers.map((l, i) => ({
              layer_id: i + 1,
              name: "Layer " + (i + 1),
              waveform: l.waveform,
              volume: l.volume,
              mute: false,
              solo: false,
              default_adsr: {
                attack_ms: l.adsr.attack_ms,
                decay_ms: l.adsr.decay_ms,
                sustain: l.adsr.sustain_level !== undefined ? l.adsr.sustain_level : l.adsr.sustain,
                release_ms: l.adsr.release_ms
              },
              notes: l.notes.map(n => ({
                id: "n_" + Math.random().toString(36).substr(2, 9),
                frequency_hz: n.frequency_hz,
                start_time_ms: n.start_time_ms,
                duration_ms: n.duration_ms
              }))
            }))
          };
          loadProjectFromObject(newProj);
          const sel = document.getElementById("selPresets");
          if (sel) sel.value = "slot:" + slotId;
          logTerminal(`Downloaded slot "${slotId}" (${soundData.total_duration_ms} ms, ${soundData.layer_count} layers) from ESP32 into editor.`, "info");
        }
      } catch(err) {
        logTerminal("Download slot failed: " + err.message, "err");
      }
    }
    window.downloadSlot = downloadSlot;

    // Upload active sound to target slot
    async function uploadActiveToSlot() {
      const slotId = (document.getElementById("txtSlotId").value || "BOOT_SUCCESS").trim().toUpperCase();
      if (!slotId || slotId.length > 15 || !/^[A-Z0-9_]+$/.test(slotId)) {
        alert("Slot ID must contain 1-15 uppercase alphanumeric characters or underscores.");
        return;
      }
      if (project.totalNotesCount === 0) {
        alert("Please add at least one note before uploading to ESP32 hardware flash.");
        return;
      }

      // Prepare firmware-compliant JSON payload
      const payload = {
        slot_id: slotId,
        total_duration_ms: project.totalDurationMs,
        layer_count: project.layers.length,
        layers: project.layers.map(l => ({
          waveform: l.waveform,
          volume: parseFloat(l.volume.toFixed(2)),
          adsr: {
            attack_ms: Math.round(l.adsr.attack_ms),
            decay_ms: Math.round(l.adsr.decay_ms),
            sustain_level: parseFloat(l.adsr.sustain.toFixed(2)),
            release_ms: Math.round(l.adsr.release_ms)
          },
          notes: l.notes.map(n => ({
            start_time_ms: Math.round(n.start_time_ms),
            duration_ms: Math.round(n.duration_ms),
            frequency_hz: parseFloat(n.frequency_hz.toFixed(2))
          }))
        }))
      };

      const jsonStr = JSON.stringify(payload);
      try {
        logTerminal(`Uploading sound to slot ${slotId}...`, "info");
        const res = await sendSerialCommand(`UPLOAD ${slotId} ${jsonStr}`);
        if (res.includes("OK")) {
          alert(`✔ Successfully uploaded to slot "${slotId}"!`);
          await querySlots();
          const sel = document.getElementById("selPresets");
          if (sel) sel.value = "slot:" + slotId;
        } else {
          alert("Upload failed: " + res);
        }
      } catch(err) {
        alert("Upload error: " + err.message);
      }
    }
    // btnUploadSlot in header opens slotDialog; upload occurs via btnUploadSlotModal inside dialog

    // Hardware Playback controls
    document.getElementById("btnPlayDevice").addEventListener("click", () => {
      const slotId = (document.getElementById("txtSlotId").value || "BOOT_SUCCESS").trim().toUpperCase();
      sendSerialCommand("PLAY " + slotId).catch((error) => {
        logTerminal("Device playback failed: " + error.message, "err");
      });
    });
    document.getElementById("btnStopDevice").addEventListener("click", () => {
      stopPlayback();
      sendSerialCommand("STOP").catch((error) => {
        logTerminal("Could not stop device playback: " + error.message, "err");
      });
    });

    // Hardware Volume
    const rngHwVol = document.getElementById("rngHwVol");
    function setHardwareVolume(vol) {
      displayHardwareVolume(vol);
      sendSerialCommand("SET_VOLUME " + vol.toFixed(3)).catch((error) => {
        logTerminal("Could not set hardware volume: " + error.message, "err");
      });
    }
    rngHwVol.addEventListener("input", (e) => {
      displayHardwareVolume(parseFloat(e.target.value));
    });
    rngHwVol.addEventListener("change", (e) => {
      setHardwareVolume(parseFloat(e.target.value));
    });
    document.getElementById("btnMuteHwVol").addEventListener("click", () => {
      if (!hardwareVolumeKnown) return;
      const volume = hardwareVolumeMuted ? lastHardwareVolume : 0;
      rngHwVol.value = String(volume);
      setHardwareVolume(volume);
    });

    async function readHwVolume() {
      try {
        const res = await sendSerialCommand("GET_VOLUME");
        if (res.startsWith("OK: ")) {
          const vol = parseFloat(res.slice(4));
          if (Number.isFinite(vol) && vol >= 0 && vol <= 1) {
            displayHardwareVolume(vol);
            return;
          }
        }
        markHardwareVolumeUnavailable();
        logTerminal("Could not read hardware volume: " + res, "err");
      } catch(error) {
        markHardwareVolumeUnavailable();
        logTerminal("Could not read hardware volume: " + error.message, "err");
      }
    }

    // Erase All
    document.getElementById("btnEraseAll").addEventListener("click", async () => {
      if (confirm("DANGER: Erase ALL stored chimes in flash memory (chimes_v1 namespace)?")) {
        try {
          await sendSerialCommand("ERASE_ALL");
          querySlots();
        } catch(error) {
          logTerminal("Erase all failed: " + error.message, "err");
        }
      }
    });

    // Raw Command Console
    document.getElementById("btnSendCmd").addEventListener("click", () => {
      const inp = document.getElementById("cmdInput");
      const cmd = inp.value.trim();
      if (cmd) {
        sendSerialCommand(cmd).catch((error) => {
          logTerminal("Command failed: " + error.message, "err");
        });
        inp.value = "";
      }
    });
    document.getElementById("cmdInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btnSendCmd").click();
    });

    // Playback Destination Target Switch (PC vs ESP32)
    let playbackTarget = "pc";
    window.playbackTarget = playbackTarget;
    window.isConnected = false;
    window.isFirmwareVerified = false;
    window.sendSerialCommand = sendSerialCommand;

    const btnTargetPc = document.getElementById("btnTargetPc");
    const btnTargetEsp = document.getElementById("btnTargetEsp");

    function setPlaybackTarget(target) {
      if (target === "esp" && (!isConnected || !isFirmwareVerified)) {
        return;
      }
      playbackTarget = target;
      window.playbackTarget = target;
      if (btnTargetPc && btnTargetEsp) {
        btnTargetPc.classList.toggle("active", target === "pc");
        btnTargetPc.setAttribute("aria-checked", String(target === "pc"));
        btnTargetEsp.classList.toggle("active", target === "esp");
        btnTargetEsp.setAttribute("aria-checked", String(target === "esp"));
      }
    }

    if (btnTargetPc) btnTargetPc.addEventListener("click", () => setPlaybackTarget("pc"));
    if (btnTargetEsp) {
      btnTargetEsp.addEventListener("click", () => {
        if (!isConnected || !isFirmwareVerified) return;
        setPlaybackTarget("esp");
      });
    }

    window.playHardwareTone = function(freq, durMs = 250, waveform = 2) {
      if (!isConnected || !isFirmwareVerified) return;
      const cmd = `TONE ${freq.toFixed(2)} ${Math.round(durMs)} ${waveform}`;
      sendSerialCommand(cmd).catch((err) => {
        logTerminal("Hardware tone failed: " + err.message, "err");
      });
    };
    window.playHardwareKeyPreview = window.playHardwareTone;

    // Modal Dialogs
    const slotDialog = document.getElementById("slot-dialog");
    const btnUploadSlot = document.getElementById("btnUploadSlot");
    const btnOpenSlots = document.getElementById("btnOpenSlots");
    const btnCloseSlotModal = document.getElementById("btnCloseSlotModal");
    const btnUploadSlotModal = document.getElementById("btnUploadSlotModal");

    if (btnUploadSlot) {
      btnUploadSlot.addEventListener("click", () => {
        if (slotDialog) slotDialog.showModal();
      });
    }
    if (btnOpenSlots) {
      btnOpenSlots.addEventListener("click", () => {
        if (slotDialog) slotDialog.showModal();
      });
    }
    if (btnCloseSlotModal && slotDialog) {
      btnCloseSlotModal.addEventListener("click", () => slotDialog.close());
    }
    if (btnUploadSlotModal) {
      btnUploadSlotModal.addEventListener("click", uploadActiveToSlot);
    }



    // Master Controls
    document.getElementById("btnPlay").addEventListener("click", () => {
      if (playbackTarget === "pc") {
        view.isPlaying ? stopPlayback() : startPlayback();
      } else {
        if (!isConnected || !isFirmwareVerified) {
          alert("Connect and verify ESP32 hardware first to play through device speaker.");
          return;
        }
        if (view.isPlaying) {
          stopPlayback();
        } else {
          if (project.totalNotesCount > 0) {
            startPlayback({ espTarget: true });
            const payload = {
              slot_id: (document.getElementById("txtSlotId").value || project.slot_id || "PREVIEW").trim().toUpperCase(),
              total_duration_ms: project.totalDurationMs,
              layer_count: project.layers.length,
              layers: project.layers.map(l => ({
                waveform: l.waveform,
                volume: parseFloat(l.volume.toFixed(2)),
                adsr: {
                  attack_ms: Math.round(l.adsr.attack_ms),
                  decay_ms: Math.round(l.adsr.decay_ms),
                  sustain_level: parseFloat(l.adsr.sustain.toFixed(2)),
                  release_ms: Math.round(l.adsr.release_ms)
                },
                notes: l.notes.map(n => ({
                  start_time_ms: Math.round(n.start_time_ms),
                  duration_ms: Math.round(n.duration_ms),
                  frequency_hz: parseFloat(n.frequency_hz.toFixed(2))
                }))
              }))
            };
            sendSerialCommand("PREVIEW " + JSON.stringify(payload)).catch((error) => {
              logTerminal("Device live preview failed: " + error.message, "err");
              stopPlayback();
            });
          } else {
            const slotId = (document.getElementById("txtSlotId").value || "BOOT_SUCCESS").trim().toUpperCase();
            startPlayback({ espTarget: true });
            sendSerialCommand("PLAY " + slotId).catch((error) => {
              logTerminal("Device playback failed: " + error.message, "err");
              stopPlayback();
            });
          }
        }
      }
    });

    document.getElementById("selSnap").addEventListener("change", (e) => {
      project.snap_ms = parseInt(e.target.value);
      render();
    });

    document.getElementById("numBpm").addEventListener("input", (e) => {
      project.bpm = Math.max(40, Math.min(300, parseInt(e.target.value) || 120));
      render();
    });

    document.getElementById("rngMasterVol").addEventListener("input", (e) => {
      setMasterVolume(parseFloat(e.target.value));
    });
    document.getElementById("btnMuteMasterVol").addEventListener("click", () => {
      setMasterVolume(masterVolumeMuted ? lastMasterVolume : 0);
    });

    // Initial Setup
    function initStudio() {
      if (typeof BUNDLED_PRESETS !== "undefined" && BUNDLED_PRESETS["success_chime.chime.json"]) {
        loadProjectFromObject(BUNDLED_PRESETS["success_chime.chime.json"]);
        const sel = document.getElementById("selPresets");
        if (sel) sel.value = "preset:success_chime.chime.json";
      } else {
        updateLayersList();
        updateInspector();
      }
      resizeCanvases();
    }

    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", initStudio);
    } else {
      initStudio();
    }