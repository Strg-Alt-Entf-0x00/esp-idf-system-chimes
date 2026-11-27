// DOM Elements
    const canvas = document.getElementById("pianoCanvas");
    const ctx = canvas.getContext("2d");

    function getAdsrCanvas() {
      return document.getElementById("adsrCanvas");
    }

    // Initialize Canvas Sizes
    function resizeCanvases() {
      const container = document.getElementById("pianoRollContainer");
      if (container && canvas) {
        canvas.width = container.clientWidth * window.devicePixelRatio;
        canvas.height = container.clientHeight * window.devicePixelRatio;
        canvas.style.width = container.clientWidth + "px";
        canvas.style.height = container.clientHeight + "px";
      }

      const curAdsr = getAdsrCanvas();
      if (curAdsr) {
        curAdsr.width = curAdsr.clientWidth * window.devicePixelRatio;
        curAdsr.height = curAdsr.clientHeight * window.devicePixelRatio;
      }
      render();
      drawAdsrCurve();
    }
    window.addEventListener("resize", resizeCanvases);

    // Snap helper
    function snapMs(ms) {
      if (project.snap_ms <= 0) return Math.round(ms);
      return Math.round(ms / project.snap_ms) * project.snap_ms;
    }

    // Coordinate conversion
    function timeToX(ms) {
      return view.keyWidth + (ms - view.scrollX) * view.pixelsPerMs;
    }

    function xToTime(x) {
      return view.scrollX + (x - view.keyWidth) / view.pixelsPerMs;
    }

    function midiToY(midi) {
      return view.rulerHeight + (MAX_MIDI - midi) * view.rowHeight - view.scrollY;
    }

    function yToMidi(y) {
      const relY = y - view.rulerHeight + view.scrollY;
      return MAX_MIDI - Math.floor(relY / view.rowHeight);
    }

    // Web Audio Engine
    let audioCtx = null;
    let masterGainNode = null;
    let activeOscillators = [];
    let playbackStartTime = 0;
    let playbackRafId = null;

    function getAudioContext() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!masterGainNode) {
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = project.master_volume;
        masterGainNode.connect(audioCtx.destination);
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function applyPreviewMasterVolume(volume) {
      if (!audioCtx || !masterGainNode) return;
      const now = audioCtx.currentTime;
      masterGainNode.gain.cancelScheduledValues(now);
      masterGainNode.gain.setTargetAtTime(volume, now, 0.015);
    }

    function playNotePreview(freq, waveId, adsr, durMs = 250) {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const waveType = WAVEFORMS[waveId] ? WAVEFORMS[waveId].key.toLowerCase() : "sine";
      if (waveType === "noise") {
        // Noise buffer
        const bufSize = ctx.sampleRate * 0.5;
        const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = noiseBuf;
        noiseNode.connect(gain);
        gain.connect(masterGainNode);
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durMs / 1000);
        noiseNode.start(now);
        noiseNode.stop(now + durMs / 1000);
        return;
      }

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const now = ctx.currentTime;
      const tAttack = adsr.attack_ms / 1000;
      const tDecay = adsr.decay_ms / 1000;
      const tRelease = adsr.release_ms / 1000;
      const sustainVal = adsr.sustain;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.7, now + tAttack);
      gain.gain.linearRampToValueAtTime(0.7 * sustainVal, now + tAttack + tDecay);
      gain.gain.setValueAtTime(0.7 * sustainVal, now + durMs / 1000);
      gain.gain.linearRampToValueAtTime(0.0001, now + durMs / 1000 + tRelease);

      osc.connect(gain);
      gain.connect(masterGainNode);
      osc.start(now);
      osc.stop(now + durMs / 1000 + tRelease);
    }

    function setPlaybackButtonState(isPlaying) {
      const button = document.getElementById("btnPlay");
      const playIcon = document.getElementById("playIcon");
      const stopIcon = document.getElementById("stopIcon");
      if (!button || !playIcon || !stopIcon) return;

      playIcon.classList.toggle("is-hidden", isPlaying);
      stopIcon.classList.toggle("is-hidden", !isPlaying);
      button.classList.toggle("active", isPlaying);
      button.setAttribute("aria-label", isPlaying ? "Stop playback" : "Play pattern");
      button.setAttribute("aria-pressed", String(isPlaying));
      button.dataset.tooltip = isPlaying ? "Stop playback (Spacebar)" : "Play pattern (Spacebar)";
    }

    function startPlayback(options = {}) {
      const isEsp = options.espTarget || false;
      stopPlayback();

      view.isPlaying = true;
      view.origPlaybackScrollX = view.scrollX;
      setPlaybackButtonState(true);
      playbackStartTime = performance.now();

      if (!isEsp) {
        const ctx = getAudioContext();
        const hasSolo = project.layers.some(l => l.solo);
        const activeLayers = project.layers.filter(l => hasSolo ? l.solo : !l.mute);
        const now = ctx.currentTime;

        for (const layer of activeLayers) {
          const adsr = layer.adsr;
          const waveKey = WAVEFORMS[layer.waveform].key.toLowerCase();

          for (const note of layer.notes) {
            const tStart = now + (note.start_time_ms / 1000);
            const tDur = note.duration_ms / 1000;
            const tAttack = adsr.attack_ms / 1000;
            const tDecay = adsr.decay_ms / 1000;
            const tRelease = adsr.release_ms / 1000;
            const peakVol = layer.volume;
            const susVol = peakVol * adsr.sustain;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, tStart);
            gain.gain.linearRampToValueAtTime(peakVol, tStart + tAttack);
            gain.gain.linearRampToValueAtTime(susVol, tStart + tAttack + tDecay);
            gain.gain.setValueAtTime(susVol, tStart + tDur);
            gain.gain.linearRampToValueAtTime(0.0001, tStart + tDur + tRelease);
            gain.connect(masterGainNode);

            if (waveKey === "noise") {
              const bufSize = Math.max(1, Math.round(ctx.sampleRate * (tDur + tRelease)));
              const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
              const data = noiseBuf.getChannelData(0);
              for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
              const noiseNode = ctx.createBufferSource();
              noiseNode.buffer = noiseBuf;
              noiseNode.connect(gain);
              noiseNode.start(tStart);
              noiseNode.stop(tStart + tDur + tRelease);
              activeOscillators.push(noiseNode);
            } else {
              const osc = ctx.createOscillator();
              osc.type = waveKey;
              osc.frequency.setValueAtTime(note.frequency_hz, tStart);
              osc.connect(gain);
              osc.start(tStart);
              osc.stop(tStart + tDur + tRelease);
              activeOscillators.push(osc);
            }
          }
        }
      }

      // Playhead animation loop with auto-scroll (page scroll follow playhead)
      function updatePlayhead() {
        if (!view.isPlaying) return;
        const elapsedMs = performance.now() - playbackStartTime;
        view.playheadMs = elapsedMs;
        const statElem = document.getElementById("statPlayhead");
        if (statElem) statElem.textContent = Math.round(elapsedMs) + " ms";

        // Auto-Scroll: Follow playhead across pages during playback
        const dpr = window.devicePixelRatio || 1;
        const visibleWidth = (canvas.width / dpr) - view.keyWidth;
        if (visibleWidth > 0 && view.pixelsPerMs > 0) {
          const visibleDurationMs = visibleWidth / view.pixelsPerMs;
          const pageMarginMs = Math.min(100, visibleDurationMs * 0.05);

          // If playhead crosses past the right screen edge, jump to next page
          if (view.playheadMs >= view.scrollX + visibleDurationMs) {
            view.scrollX = Math.max(0, view.playheadMs - pageMarginMs);
          } else if (view.playheadMs < view.scrollX) {
            view.scrollX = Math.max(0, view.playheadMs - pageMarginMs);
          }
        }

        const maxDuration = Math.max(300, project.totalDurationMs + 200);
        if (elapsedMs > maxDuration) {
          stopPlayback();
          return;
        }
        render();
        playbackRafId = requestAnimationFrame(updatePlayhead);
      }
      playbackRafId = requestAnimationFrame(updatePlayhead);
    }

    function stopPlayback() {
      const wasPlaying = view.isPlaying;
      view.isPlaying = false;
      setPlaybackButtonState(false);
      if (playbackRafId) cancelAnimationFrame(playbackRafId);
      for (const node of activeOscillators) {
        try { node.stop(); node.disconnect(); } catch(e) {}
      }
      activeOscillators = [];
      view.playheadMs = 0;
      const statElem = document.getElementById("statPlayhead");
      if (statElem) statElem.textContent = "0 ms";

      // Return to start position on stop (standard DAW behavior)
      if (view.origPlaybackScrollX !== undefined) {
        view.scrollX = view.origPlaybackScrollX;
      }
      render();

      // If playing on ESP32, send STOP command
      if (wasPlaying && window.playbackTarget === "esp" && typeof sendSerialCommand === "function") {
        sendSerialCommand("STOP").catch(() => {});
      }
    }

    window.startPlayback = startPlayback;
    window.stopPlayback = stopPlayback;

    // Render Main Piano Roll
    function render() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.fillStyle = "#090d16";
      ctx.fillRect(view.keyWidth, view.rulerHeight, w - view.keyWidth, h - view.rulerHeight);

      // Draw Key Lanes
      const startMidi = yToMidi(h);
      const endMidi = yToMidi(view.rulerHeight);

      for (let m = startMidi; m <= endMidi; m++) {
        if (m < MIN_MIDI || m > MAX_MIDI) continue;
        const y = midiToY(m);
        const black = isBlackKey(m);

        // Grid Lane
        ctx.fillStyle = black ? "#0c121e" : "#101828";
        ctx.fillRect(view.keyWidth, y, w - view.keyWidth, view.rowHeight);

        // Divider
        ctx.strokeStyle = "#162238";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(view.keyWidth, y + view.rowHeight);
        ctx.lineTo(w, y + view.rowHeight);
        ctx.stroke();
      }

      // Vertical Time Grid Lines
      const startTimeMs = Math.max(0, xToTime(view.keyWidth));
      const endTimeMs = xToTime(w);
      const snap = project.snap_ms > 0 ? project.snap_ms : 50;
      const beatMs = (60 / project.bpm) * 1000;

      const firstGridMs = Math.floor(startTimeMs / snap) * snap;
      for (let t = firstGridMs; t <= endTimeMs; t += snap) {
        const x = timeToX(t);
        const isBeat = Math.abs(t % beatMs) < snap / 2;

        ctx.strokeStyle = isBeat ? "rgba(0, 240, 255, 0.25)" : "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = isBeat ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, view.rulerHeight);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Draw Notes for all layers
      project.layers.forEach((layer, lIdx) => {
        const isCurrent = lIdx === project.activeLayerIndex;
        const waveColor = WAVEFORMS[layer.waveform].color;

        for (const note of layer.notes) {
          const midi = freqToMidi(note.frequency_hz);
          const x = timeToX(note.start_time_ms);
          const y = midiToY(midi);
          const noteW = Math.max(8, note.duration_ms * view.pixelsPerMs);
          const isSelected = project.selectedNote === note;

          // Note Body
          ctx.fillStyle = isCurrent ? waveColor : "rgba(100, 116, 139, 0.4)";
          ctx.beginPath();
          ctx.roundRect(x, y + 2, noteW, view.rowHeight - 4, 4);
          ctx.fill();

          // Selection Glow & Border
          if (isSelected) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Note resize handle pill on right
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(x + noteW - 4, y + 3, 3, view.rowHeight - 6);

          // Note Label
          if (noteW > 25) {
            ctx.fillStyle = isCurrent ? "#080b12" : "#ffffff";
            ctx.font = "bold 9px " + getComputedStyle(document.body).fontFamily;
            ctx.fillText(midiToName(midi), x + 5, y + view.rowHeight - 6);
          }
        }
      });

      // Draw Piano Keyboard on Left
      for (let m = startMidi; m <= endMidi; m++) {
        if (m < MIN_MIDI || m > MAX_MIDI) continue;
        const y = midiToY(m);
        const black = isBlackKey(m);

        ctx.fillStyle = black ? "#121927" : "#e2e8f0";
        ctx.fillRect(0, y, view.keyWidth, view.rowHeight);

        ctx.strokeStyle = "#080b12";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y, view.keyWidth, view.rowHeight);

        // Key Labels on C notes
        if (m % 12 === 0) {
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 9px " + getComputedStyle(document.body).fontFamily;
          ctx.fillText(midiToName(m), 6, y + view.rowHeight - 5);
        }
      }

      // Keyboard Separator Line
      ctx.strokeStyle = "#212d47";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(view.keyWidth, 0);
      ctx.lineTo(view.keyWidth, h);
      ctx.stroke();

      // Top Ruler
      ctx.fillStyle = "#080c14";
      ctx.fillRect(0, 0, w, view.rulerHeight);
      ctx.strokeStyle = "#212d47";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, view.rulerHeight);

      // Ruler ticks & ms labels
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px " + getComputedStyle(document.body).fontFamily;
      for (let t = firstGridMs; t <= endTimeMs; t += snap * 4) {
        const rx = timeToX(t);
        ctx.strokeStyle = "#475569";
        ctx.beginPath();
        ctx.moveTo(rx, view.rulerHeight - 8);
        ctx.lineTo(rx, view.rulerHeight);
        ctx.stroke();

        ctx.fillText(t + "ms", rx + 4, view.rulerHeight - 6);
      }

      // Playhead Line
      if (view.playheadMs > 0) {
        const px = timeToX(view.playheadMs);
        if (px >= view.keyWidth && px <= w) {
          ctx.strokeStyle = "#00f0ff";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#00f0ff";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, h);
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }
      }

      ctx.restore();
      updateFooterStats();
    }

    // Draw ADSR Visual Curve
    function drawAdsrCurve() {
      const curAdsr = getAdsrCanvas();
      if (!curAdsr) return;
      const curCtx = curAdsr.getContext("2d");
      if (!curCtx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = curAdsr.width / dpr;
      const h = curAdsr.height / dpr;

      curCtx.save();
      curCtx.scale(dpr, dpr);
      curCtx.clearRect(0, 0, w, h);

      const layer = project.layers[project.activeLayerIndex];
      if (!layer) { curCtx.restore(); return; }
      const a = layer.adsr;

      const totalTime = Math.max(300, a.attack_ms + a.decay_ms + 100 + a.release_ms);
      const padX = 14;
      const padY = 12;
      const innerW = w - padX * 2;
      const innerH = h - padY * 2;

      const x0 = padX;
      const y0 = h - padY;
      const xA = x0 + (a.attack_ms / totalTime) * innerW;
      const yA = padY;
      const xD = xA + (a.decay_ms / totalTime) * innerW;
      const yD = padY + (1.0 - a.sustain) * innerH;
      const xS = xD + (100 / totalTime) * innerW; // hold sustain
      const yS = yD;
      const xR = xS + (a.release_ms / totalTime) * innerW;
      const yR = y0;

      // Fill area under curve
      const grad = curCtx.createLinearGradient(0, padY, 0, h - padY);
      grad.addColorStop(0, "rgba(0, 229, 163, 0.4)");
      grad.addColorStop(1, "rgba(0, 229, 163, 0.02)");

      curCtx.fillStyle = grad;
      curCtx.beginPath();
      curCtx.moveTo(x0, y0);
      curCtx.lineTo(xA, yA);
      curCtx.lineTo(xD, yD);
      curCtx.lineTo(xS, yS);
      curCtx.lineTo(xR, yR);
      curCtx.closePath();
      curCtx.fill();

      // Stroke curve
      curCtx.strokeStyle = "#00e5a3";
      curCtx.lineWidth = 2.5;
      curCtx.beginPath();
      curCtx.moveTo(x0, y0);
      curCtx.lineTo(xA, yA);
      curCtx.lineTo(xD, yD);
      curCtx.lineTo(xS, yS);
      curCtx.lineTo(xR, yR);
      curCtx.stroke();

      // Control points
      const points = [[xA, yA], [xD, yD], [xS, yS], [xR, yR]];
      curCtx.fillStyle = "#ffffff";
      for (const [px, py] of points) {
        curCtx.beginPath();
        curCtx.arc(px, py, 3.5, 0, Math.PI * 2);
        curCtx.fill();
      }

      curCtx.restore();
    }

    // Mouse Interaction on Piano Roll
