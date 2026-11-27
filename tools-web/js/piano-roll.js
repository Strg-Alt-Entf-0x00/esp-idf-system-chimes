let expandedLayerIndex = 0;

// Floating HUD Toast for Zoom & Snap Navigation
let hudToastTimer = null;
function showPianoToast(text) {
  const toast = document.getElementById("pianoHudToast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("visible");
  if (hudToastTimer) clearTimeout(hudToastTimer);
  hudToastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1200);
}

// Floating Note Hover Tooltip (HUD)
const noteHoverTooltip = document.getElementById("noteHoverTooltip");
function hideNoteTooltip() {
  if (noteHoverTooltip) {
    noteHoverTooltip.style.display = "none";
  }
}

function showNoteTooltip(note, clientX, clientY) {
  if (!noteHoverTooltip) return;
  const midi = freqToMidi(note.frequency_hz);
  const inspPitch = document.getElementById("inspPitch");
  const inspMidi = document.getElementById("inspMidi");
  const inspFreq = document.getElementById("inspFreq");
  const inspStart = document.getElementById("inspStart");
  const inspDuration = document.getElementById("inspDuration");

  if (inspPitch) inspPitch.textContent = midiToName(midi);
  if (inspMidi) inspMidi.textContent = "(MIDI " + midi + ")";
  if (inspFreq) inspFreq.textContent = note.frequency_hz.toFixed(1);
  if (inspStart) inspStart.textContent = note.start_time_ms;
  if (inspDuration) inspDuration.textContent = note.duration_ms;

  const left = Math.min(window.innerWidth - 220, Math.max(10, clientX + 16));
  const top = Math.min(window.innerHeight - 130, Math.max(10, clientY - 12));

  noteHoverTooltip.style.left = left + "px";
  noteHoverTooltip.style.top = top + "px";
  noteHoverTooltip.style.display = "flex";
}

canvas.addEventListener("mouseleave", () => {
  hideNoteTooltip();
});


function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function findNoteAt(x, y) {
  const timeMs = xToTime(x);
  const midi = yToMidi(y);

  for (let i = project.layers.length - 1; i >= 0; i--) {
    const layer = project.layers[i];
    for (const note of layer.notes) {
      const noteMidi = freqToMidi(note.frequency_hz);
      if (noteMidi === midi && timeMs >= note.start_time_ms && timeMs <= (note.start_time_ms + note.duration_ms)) {
        const isHandle = (timeMs >= note.start_time_ms + note.duration_ms - 25);
        return { note, layer, layerIndex: i, isHandle };
      }
    }
  }
  return null;
}

let longPressTimer = null;

canvas.addEventListener("mousedown", (e) => {
  const pos = getCanvasPos(e);

  // Check Piano Keys Click (PC Web Audio vs ESP32 Speaker)
  if (pos.x < view.keyWidth && pos.y >= view.rulerHeight) {
    const midi = yToMidi(pos.y);
    if (midi >= MIN_MIDI && midi <= MAX_MIDI) {
      const curLayer = project.layers[project.activeLayerIndex];
      const freq = midiToFreq(midi);
      if (window.playbackTarget === "esp") {
        if (typeof window.playHardwareTone === "function") {
          window.playHardwareTone(freq, 250, curLayer ? curLayer.waveform : 2);
        } else if (typeof window.playHardwareKeyPreview === "function") {
          window.playHardwareKeyPreview(freq, 250, curLayer ? curLayer.waveform : 2);
        }
      } else {
        playNotePreview(freq, curLayer.waveform, curLayer.adsr);
      }
    }
    return;
  }

  // Check Ruler Click (Seek)
  if (pos.y < view.rulerHeight) {
    const seekTime = Math.max(0, snapMs(xToTime(pos.x)));
    view.playheadMs = seekTime;
    render();
    return;
  }

  // Grid Notes Interaction
  const match = findNoteAt(pos.x, pos.y);
  if (match) {
    project.selectedNote = match.note;
    project.activeLayerIndex = match.layerIndex;
    updateLayersList();
    updateInspector();

    view.isDragging = !match.isHandle;
    view.isResizing = match.isHandle;
    view.dragTarget = match.note;
    view.dragStartX = pos.x;
    view.dragStartY = pos.y;
    view.origStartMs = match.note.start_time_ms;
    view.origDurationMs = match.note.duration_ms;
    view.origMidi = freqToMidi(match.note.frequency_hz);
    render();

    // Setup long-press deletion timer
    if (e.button === 0 && !match.isHandle) {
      longPressTimer = setTimeout(() => {
        if (project.selectedNote === match.note && !view.isDragging) {
          deleteSelectedNote();
        }
      }, 500);
    }
    return;
  }

  // Empty Grid Click -> Create New Note in Active Layer
  if (e.button === 0 && pos.x >= view.keyWidth && pos.y >= view.rulerHeight) {
    const activeLayer = project.layers[project.activeLayerIndex];
    if (activeLayer.notes.length >= 32) {
      alert("Firmware limit reached: Max 32 notes per layer!");
      return;
    }
    const newStartMs = Math.max(0, snapMs(xToTime(pos.x)));
    const midi = yToMidi(pos.y);
    const freq = midiToFreq(midi);

    // Prevent duplicate note if clicked directly on an existing note on the same pitch
    const existingOnPitch = activeLayer.notes.find(n =>
      freqToMidi(n.frequency_hz) === midi &&
      newStartMs >= n.start_time_ms &&
      newStartMs < (n.start_time_ms + n.duration_ms)
    );
    if (existingOnPitch) {
      return;
    }

    let defaultDur = project.snap_ms > 0 ? project.snap_ms * 4 : 150;
    // Limit duration to not collide with subsequent note on same pitch
    const nextOnPitch = activeLayer.notes
      .filter(n => freqToMidi(n.frequency_hz) === midi && n.start_time_ms > newStartMs)
      .sort((a, b) => a.start_time_ms - b.start_time_ms)[0];
    if (nextOnPitch) {
      if ((nextOnPitch.start_time_ms - newStartMs) < 10) {
        return;
      }
      if ((newStartMs + defaultDur) > nextOnPitch.start_time_ms) {
        defaultDur = Math.max(10, nextOnPitch.start_time_ms - newStartMs);
      }
    }

    const newNote = {
      id: "n_" + Date.now(),
      frequency_hz: freq,
      start_time_ms: newStartMs,
      duration_ms: defaultDur
    };

    activeLayer.notes.push(newNote);
    project.selectedNote = newNote;
    updateInspector();
    updateLayersList();
    if (window.playbackTarget !== "esp") {
      playNotePreview(freq, activeLayer.waveform, activeLayer.adsr, defaultDur);
    }
    render();
  }
});

// Wheel Navigation: Ctrl+Wheel (Zoom), Alt+Wheel (Snap cycle), Shift+Wheel (Pan), Wheel (Scroll)
const SNAP_CYCLE_VALUES = [10, 25, 50, 100, 250, 0];

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  if (e.ctrlKey) {
    // Zoom Time Axis
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const oldZoom = view.pixelsPerMs;
    view.pixelsPerMs = Math.max(0.08, Math.min(2.5, view.pixelsPerMs * zoomFactor));

    const pos = getCanvasPos(e);
    if (pos.x >= view.keyWidth) {
      const timeAtCursor = view.scrollX + (pos.x - view.keyWidth) / oldZoom;
      view.scrollX = Math.max(0, timeAtCursor - (pos.x - view.keyWidth) / view.pixelsPerMs);
    }
    showPianoToast("Zoom: " + Math.round((view.pixelsPerMs / 0.35) * 100) + "%");
    render();
    return;
  }

  if (e.altKey) {
    // Cycle Snap Interval
    const currentSnap = project.snap_ms || 0;
    let idx = SNAP_CYCLE_VALUES.indexOf(currentSnap);
    if (idx === -1) idx = 1;
    if (e.deltaY < 0) {
      idx = (idx - 1 + SNAP_CYCLE_VALUES.length) % SNAP_CYCLE_VALUES.length;
    } else {
      idx = (idx + 1) % SNAP_CYCLE_VALUES.length;
    }
    project.snap_ms = SNAP_CYCLE_VALUES[idx];
    const snapSel = document.getElementById("selSnap");
    if (snapSel) snapSel.value = String(project.snap_ms);

    showPianoToast("Snap: " + (project.snap_ms === 0 ? "Off" : project.snap_ms + " ms"));
    render();
    return;
  }

  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    // Horizontal Pan
    const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
    const deltaMs = (delta / view.pixelsPerMs) * 0.4;
    view.scrollX = Math.max(0, view.scrollX + deltaMs);
    render();
    return;
  }

  // Vertical Pitch Scroll
  const dpr = window.devicePixelRatio || 1;
  const viewH = canvas.height / dpr - view.rulerHeight;
  const totalH = (MAX_MIDI - MIN_MIDI + 1) * view.rowHeight;
  const maxScrollY = Math.max(0, totalH - viewH);
  view.scrollY = Math.max(0, Math.min(maxScrollY, view.scrollY + e.deltaY * 0.5));
  render();
}, { passive: false });

// Double click to delete note
canvas.addEventListener("dblclick", (e) => {
  const pos = getCanvasPos(e);
  const match = findNoteAt(pos.x, pos.y);
  if (match) {
    project.activeLayerIndex = match.layerIndex;
    project.selectedNote = match.note;
    deleteSelectedNote();
  }
});

// Right click context menu to delete note
canvas.addEventListener("contextmenu", (e) => {
  const pos = getCanvasPos(e);
  const match = findNoteAt(pos.x, pos.y);
  if (match) {
    e.preventDefault();
    project.activeLayerIndex = match.layerIndex;
    project.selectedNote = match.note;
    deleteSelectedNote();
  }
});

window.addEventListener("mousemove", (e) => {
  const pos = getCanvasPos(e);

  if (longPressTimer && (Math.abs(pos.x - view.dragStartX) > 4 || Math.abs(pos.y - view.dragStartY) > 4)) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  // Cursor & Tooltip update
  if (!view.isDragging && !view.isResizing) {
    if (pos.x < view.keyWidth) {
      canvas.style.cursor = "pointer";
      hideNoteTooltip();
    } else if (pos.y < view.rulerHeight) {
      canvas.style.cursor = "pointer";
      hideNoteTooltip();
    } else {
      const match = findNoteAt(pos.x, pos.y);
      if (match) {
        canvas.style.cursor = match.isHandle ? "ew-resize" : "grab";
        showNoteTooltip(match.note, e.clientX, e.clientY);
      } else {
        canvas.style.cursor = "crosshair";
        hideNoteTooltip();
      }
    }
    return;
  }

  hideNoteTooltip();

  // Note Dragging (Move Time & Pitch)
  if (view.isDragging && view.dragTarget) {
    const activeLayer = project.layers[project.activeLayerIndex];
    const dur = view.dragTarget.duration_ms;
    const deltaMs = (pos.x - view.dragStartX) / view.pixelsPerMs;
    let desiredStart = Math.max(0, snapMs(view.origStartMs + deltaMs));

    // Handle pitch change (Y axis) if mouse moved to a valid new row without collision
    let targetMidi = freqToMidi(view.dragTarget.frequency_hz);
    const candidateMidi = yToMidi(pos.y);
    if (candidateMidi >= MIN_MIDI && candidateMidi <= MAX_MIDI && candidateMidi !== targetMidi) {
      const notesOnCandidate = activeLayer.notes.filter(n => n !== view.dragTarget && freqToMidi(n.frequency_hz) === candidateMidi);
      const collides = notesOnCandidate.some(n =>
        !( (desiredStart + dur) <= n.start_time_ms || desiredStart >= (n.start_time_ms + n.duration_ms) )
      );
      if (!collides) {
        targetMidi = candidateMidi;
        view.dragTarget.frequency_hz = midiToFreq(targetMidi);
        view.origStartMs = desiredStart;
        view.dragStartX = pos.x;
      }
    }

    // Horizontal clamping on targetMidi to prevent overlapping neighboring notes
    const notesOnPitch = activeLayer.notes.filter(n => n !== view.dragTarget && freqToMidi(n.frequency_hz) === targetMidi);
    if (notesOnPitch.length > 0) {
      const prevNotes = notesOnPitch.filter(n => (n.start_time_ms + n.duration_ms) <= view.origStartMs);
      const minStart = prevNotes.length > 0 ? Math.max(...prevNotes.map(n => n.start_time_ms + n.duration_ms)) : 0;

      const nextNotes = notesOnPitch.filter(n => n.start_time_ms >= (view.origStartMs + dur));
      const maxStart = nextNotes.length > 0 ? Math.min(...nextNotes.map(n => n.start_time_ms)) - dur : Infinity;

      desiredStart = Math.max(minStart, Math.min(maxStart, desiredStart));
    }

    view.dragTarget.start_time_ms = desiredStart;
    updateInspector();
    render();
  }

  // Note Resizing (Change Duration)
  if (view.isResizing && view.dragTarget) {
    const activeLayer = project.layers[project.activeLayerIndex];
    const currentMidi = freqToMidi(view.dragTarget.frequency_hz);
    const deltaMs = (pos.x - view.dragStartX) / view.pixelsPerMs;
    let newDur = Math.max(10, snapMs(view.origDurationMs + deltaMs));

    // Clamp duration so it cannot extend into the next note on the same pitch
    const nextNotes = activeLayer.notes.filter(n =>
      n !== view.dragTarget &&
      freqToMidi(n.frequency_hz) === currentMidi &&
      n.start_time_ms >= (view.origStartMs + view.origDurationMs)
    );
    if (nextNotes.length > 0) {
      const maxDur = Math.min(...nextNotes.map(n => n.start_time_ms)) - view.dragTarget.start_time_ms;
      newDur = Math.min(newDur, Math.max(10, maxDur));
    }

    view.dragTarget.duration_ms = newDur;
    updateInspector();
    render();
  }
});

window.addEventListener("mouseup", () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (view.isDragging || view.isResizing) {
    view.isDragging = false;
    view.isResizing = false;
    view.dragTarget = null;
    render();
  }
});

// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

  if (e.code === "Space") {
    e.preventDefault();
    document.getElementById("btnPlay").click();
  } else if (e.code === "Delete" || e.code === "Backspace") {
    if (project.selectedNote) {
      e.preventDefault();
      deleteSelectedNote();
    }
  }
});

// Delete selected note
function deleteSelectedNote() {
  if (!project.selectedNote) return;
  const curLayer = project.layers[project.activeLayerIndex];
  curLayer.notes = curLayer.notes.filter(n => n !== project.selectedNote);
  project.selectedNote = null;
  updateInspector();
  updateLayersList();
  render();
}
const btnDel = document.getElementById("btnDeleteNote");
if (btnDel) btnDel.addEventListener("click", deleteSelectedNote);

// Inspector UI Sync with Status Bar
function updateInspector() {
  const n = project.selectedNote;
  const inspPitch = document.getElementById("inspPitch");
  const inspMidi = document.getElementById("inspMidi");
  const inspFreq = document.getElementById("inspFreq");
  const inspStart = document.getElementById("inspStart");
  const inspDuration = document.getElementById("inspDuration");
  const delBtn = document.getElementById("btnDeleteNote");

  if (n) {
    const midi = freqToMidi(n.frequency_hz);
    if (inspPitch) inspPitch.textContent = midiToName(midi);
    if (inspMidi) inspMidi.textContent = "MIDI " + midi;
    if (inspFreq) inspFreq.textContent = n.frequency_hz.toFixed(1);
    if (inspStart) inspStart.textContent = n.start_time_ms;
    if (inspDuration) inspDuration.textContent = n.duration_ms;
    if (delBtn) delBtn.disabled = false;
  } else {
    if (inspPitch) inspPitch.textContent = "-";
    if (inspMidi) inspMidi.textContent = "-";
    if (inspFreq) inspFreq.textContent = "-";
    if (inspStart) inspStart.textContent = "-";
    if (inspDuration) inspDuration.textContent = "-";
    if (delBtn) delBtn.disabled = true;
  }

  const layer = project.layers[project.activeLayerIndex];
  if (layer) {
    const a = layer.adsr;
    const rAtk = document.getElementById("rngAttack");
    const rDec = document.getElementById("rngDecay");
    const rSus = document.getElementById("rngSustain");
    const rRel = document.getElementById("rngRelease");
    const tAtk = document.getElementById("txtAttack");
    const tDec = document.getElementById("txtDecay");
    const tSus = document.getElementById("txtSustain");
    const tRel = document.getElementById("txtRelease");

    if (rAtk) rAtk.value = a.attack_ms;
    if (rDec) rDec.value = a.decay_ms;
    if (rSus) rSus.value = a.sustain;
    if (rRel) rRel.value = a.release_ms;

    if (tAtk) tAtk.textContent = a.attack_ms + "ms";
    if (tDec) tDec.textContent = a.decay_ms + "ms";
    if (tSus) tSus.textContent = Math.round(a.sustain * 100) + "%";
    if (tRel) tRel.textContent = a.release_ms + "ms";

    drawAdsrCurve();
  }
}

// Layers List UI
function updateLayersList() {
  const container = document.getElementById("tracksList");
  if (!container) return;
  container.innerHTML = "";
  const countText = document.getElementById("layerCountText");
  if (countText) countText.textContent = project.layers.length;
  const addBtn = document.getElementById("btnAddLayer");
  if (addBtn) addBtn.disabled = project.layers.length >= 8;

  project.layers.forEach((layer, idx) => {
    const card = document.createElement("div");
    const isActive = (idx === project.activeLayerIndex);
    const isExpanded = (idx === expandedLayerIndex);
    card.className = "track-card" + (isActive ? " active" : "");
    const waveInfo = WAVEFORMS[layer.waveform] || WAVEFORMS[0];

    card.innerHTML = `
      <div class="track-header-row">
        <div class="track-header-left">
          <div class="track-color-pill" style="background: ${waveInfo.color};"></div>
          <span class="track-title">${layer.name} <span class="track-note-count">(${layer.notes.length}/32)</span></span>
        </div>
        ${project.layers.length > 1 ? '<button class="track-btn-del" data-action="del" title="Delete layer" aria-label="Delete layer">✕</button>' : ''}
      </div>
      <div class="track-controls-row">
        <div class="track-btns">
          <button class="track-btn ${layer.solo ? 'active-solo' : ''}" data-action="solo" title="Solo layer">S</button>
          <button class="track-btn ${layer.mute ? 'active-mute' : ''}" data-action="mute" title="Mute layer">M</button>
        </div>
        <div class="track-vol-wrap">
          <input type="range" class="track-vol-slider" data-action="vol" min="0" max="1" step="0.05" value="${layer.volume}" title="Layer volume" aria-label="Layer volume">
          <span class="track-vol-val">${Math.round(layer.volume * 100)}%</span>
        </div>
      </div>
      <div class="track-wave-row">
        <select class="track-wave-select" data-action="wave" aria-label="Select waveform">
          ${WAVEFORMS.map(w => `<option value="${w.id}" ${w.id === layer.waveform ? 'selected' : ''}>${w.label}</option>`).join('')}
        </select>
      </div>
      <div class="track-adsr-wrapper ${isExpanded ? 'expanded' : ''}">
        <button type="button" class="track-adsr-toggle" data-action="toggle-adsr" aria-expanded="${isExpanded}">
          <span>Layer Envelope (ADSR)</span>
          <svg class="adsr-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="track-adsr-drawer">
          <div class="adsr-curve-container">
            <canvas ${isActive ? 'id="adsrCanvas"' : ('id="adsrCanvas_' + idx)} class="layer-adsr-canvas"></canvas>
          </div>
          <div class="adsr-sliders-grid">
            <div class="slider-col">
              <input type="range" ${isActive ? 'id="rngAttack"' : ''} class="adsr-atk" min="0" max="500" step="5" value="${layer.adsr.attack_ms}">
              <span>Atk</span>
              <span ${isActive ? 'id="txtAttack"' : ''} class="txt-atk">${layer.adsr.attack_ms}ms</span>
            </div>
            <div class="slider-col">
              <input type="range" ${isActive ? 'id="rngDecay"' : ''} class="adsr-dec" min="0" max="1000" step="10" value="${layer.adsr.decay_ms}">
              <span>Dec</span>
              <span ${isActive ? 'id="txtDecay"' : ''} class="txt-dec">${layer.adsr.decay_ms}ms</span>
            </div>
            <div class="slider-col">
              <input type="range" ${isActive ? 'id="rngSustain"' : ''} class="adsr-sus" min="0" max="1" step="0.05" value="${layer.adsr.sustain}">
              <span>Sus</span>
              <span ${isActive ? 'id="txtSustain"' : ''} class="txt-sus">${Math.round(layer.adsr.sustain * 100)}%</span>
            </div>
            <div class="slider-col">
              <input type="range" ${isActive ? 'id="rngRelease"' : ''} class="adsr-rel" min="0" max="2000" step="10" value="${layer.adsr.release_ms}">
              <span>Rel</span>
              <span ${isActive ? 'id="txtRelease"' : ''} class="txt-rel">${layer.adsr.release_ms}ms</span>
            </div>
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest('[data-action]')) return;
      if (project.activeLayerIndex !== idx) {
        project.activeLayerIndex = idx;
        expandedLayerIndex = idx;
        updateLayersList();
        updateInspector();
        render();
      }
    });

    // Mute / Solo / Wave / Vol handlers
    const muteBtn = card.querySelector('[data-action="mute"]');
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      layer.mute = !layer.mute;
      updateLayersList();
      render();
    });

    const soloBtn = card.querySelector('[data-action="solo"]');
    soloBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      layer.solo = !layer.solo;
      updateLayersList();
      render();
    });

    const delBtn = card.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        project.layers.splice(idx, 1);
        project.activeLayerIndex = Math.max(0, idx - 1);
        expandedLayerIndex = project.activeLayerIndex;
        project.selectedNote = null;
        updateLayersList();
        updateInspector();
        render();
      });
    }

    const waveSel = card.querySelector('[data-action="wave"]');
    waveSel.addEventListener("change", (e) => {
      layer.waveform = parseInt(e.target.value);
      updateLayersList();
      render();
    });

    const volRng = card.querySelector('[data-action="vol"]');
    volRng.addEventListener("input", (e) => {
      layer.volume = parseFloat(e.target.value);
      const valSpan = card.querySelector(".track-vol-val");
      if (valSpan) valSpan.textContent = Math.round(layer.volume * 100) + "%";
    });

    // ADSR Toggle
    const adsrToggle = card.querySelector('[data-action="toggle-adsr"]');
    adsrToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      expandedLayerIndex = (expandedLayerIndex === idx) ? -1 : idx;
      if (expandedLayerIndex === idx && project.activeLayerIndex !== idx) {
        project.activeLayerIndex = idx;
      }
      updateLayersList();
      updateInspector();
    });

    // ADSR Sliders for this layer
    const atkInput = card.querySelector(".adsr-atk");
    const decInput = card.querySelector(".adsr-dec");
    const susInput = card.querySelector(".adsr-sus");
    const relInput = card.querySelector(".adsr-rel");

    if (atkInput) atkInput.addEventListener("input", (e) => {
      layer.adsr.attack_ms = parseFloat(e.target.value);
      const span = card.querySelector(".txt-atk");
      if (span) span.textContent = layer.adsr.attack_ms + "ms";
      if (idx === project.activeLayerIndex) drawAdsrCurve();
    });
    if (decInput) decInput.addEventListener("input", (e) => {
      layer.adsr.decay_ms = parseFloat(e.target.value);
      const span = card.querySelector(".txt-dec");
      if (span) span.textContent = layer.adsr.decay_ms + "ms";
      if (idx === project.activeLayerIndex) drawAdsrCurve();
    });
    if (susInput) susInput.addEventListener("input", (e) => {
      layer.adsr.sustain = parseFloat(e.target.value);
      const span = card.querySelector(".txt-sus");
      if (span) span.textContent = Math.round(layer.adsr.sustain * 100) + "%";
      if (idx === project.activeLayerIndex) drawAdsrCurve();
    });
    if (relInput) relInput.addEventListener("input", (e) => {
      layer.adsr.release_ms = parseFloat(e.target.value);
      const span = card.querySelector(".txt-rel");
      if (span) span.textContent = layer.adsr.release_ms + "ms";
      if (idx === project.activeLayerIndex) drawAdsrCurve();
    });

    container.appendChild(card);
  });

  // Re-size and draw active ADSR canvas
  setTimeout(() => {
    const curAdsr = document.getElementById("adsrCanvas");
    if (curAdsr) {
      const dpr = window.devicePixelRatio || 1;
      curAdsr.width = curAdsr.clientWidth * dpr;
      curAdsr.height = curAdsr.clientHeight * dpr;
      drawAdsrCurve();
    }
  }, 0);
}

// Add Layer Button
document.getElementById("btnAddLayer").addEventListener("click", () => {
  if (project.layers.length >= 8) return;
  const newId = project.layers.length + 1;
  project.layers.push({
    layer_id: newId,
    name: "Layer 0" + newId,
    waveform: (newId - 1) % 5,
    volume: 0.8,
    mute: false,
    solo: false,
    adsr: { attack_ms: 10, decay_ms: 50, sustain: 0.7, release_ms: 100 },
    notes: []
  });
  project.activeLayerIndex = project.layers.length - 1;
  expandedLayerIndex = project.activeLayerIndex;
  updateLayersList();
  updateInspector();
  render();
});

// Presets & Hardware Slots Dropdown Management
let cachedDeviceSlots = [];

function updatePresetsDropdown(hardwareSlots = []) {
  cachedDeviceSlots = hardwareSlots || [];
  const sel = document.getElementById("selPresets");
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = window.isConnected ? "Select Hardware Slot or Example..." : "Select Preset or Example...";
  sel.appendChild(defaultOpt);

  if (cachedDeviceSlots && cachedDeviceSlots.length > 0) {
    const groupHw = document.createElement("optgroup");
    groupHw.label = "ESP32 Hardware Slots (Live Flash)";
    cachedDeviceSlots.forEach(s => {
      const opt = document.createElement("option");
      opt.value = "slot:" + s.slot_id;
      opt.textContent = `${s.slot_id} ${s.has_sound ? `(${s.duration_ms} ms)` : '(Empty)'}`;
      groupHw.appendChild(opt);
    });
    sel.appendChild(groupHw);
  }

  if (typeof BUNDLED_PRESETS !== "undefined" && Object.keys(BUNDLED_PRESETS).length > 0) {
    const groupPresets = document.createElement("optgroup");
    groupPresets.label = "Bundled Examples (assets/)";
    for (const [key, val] of Object.entries(BUNDLED_PRESETS)) {
      const opt = document.createElement("option");
      opt.value = "preset:" + key;
      opt.textContent = val.project ? val.project.name : key;
      groupPresets.appendChild(opt);
    }
    sel.appendChild(groupPresets);
  }

  if (currentVal && sel.querySelector(`option[value="${currentVal}"]`)) {
    sel.value = currentVal;
  }
}
window.updatePresetsDropdown = updatePresetsDropdown;

const selPresets = document.getElementById("selPresets");
if (selPresets) {
  selPresets.addEventListener("change", async (e) => {
    const val = e.target.value;
    if (!val) return;

    if (val.startsWith("slot:")) {
      const slotId = val.slice(5);
      const slot = cachedDeviceSlots.find(s => s.slot_id === slotId);
      const slotInput = document.getElementById("txtSlotId");
      const nameInput = document.getElementById("txtProjectName");
      if (slotInput) slotInput.value = slotId;
      if (nameInput) nameInput.value = slotId.replace(/_/g, " ");
      project.slot_id = slotId;
      project.name = slotId.replace(/_/g, " ");

      if (slot && slot.has_sound) {
        if (typeof window.downloadSlot === "function") {
          await window.downloadSlot(slotId);
        }
      } else {
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
        updateLayersList();
        updateInspector();
        render();
        if (typeof logTerminal === "function") {
          logTerminal(`Slot "${slotId}" is currently empty on ESP32. Ready to compose.`, "info");
        }
      }
    } else if (val.startsWith("preset:")) {
      const key = val.slice(7);
      if (typeof BUNDLED_PRESETS !== "undefined" && BUNDLED_PRESETS[key]) {
        loadProjectFromObject(BUNDLED_PRESETS[key]);
        if (typeof logTerminal === "function") {
          logTerminal(`Loaded template: ${BUNDLED_PRESETS[key].project?.name || key}`, "info");
        }
      }
    } else if (typeof BUNDLED_PRESETS !== "undefined" && BUNDLED_PRESETS[val]) {
      loadProjectFromObject(BUNDLED_PRESETS[val]);
    }
  });
}

// Initial populate of presets dropdown
updatePresetsDropdown([]);

function loadProjectFromObject(data) {
  const p = data.project || {};
  const g = data.global || {};

  project.name = p.name || "Untitled";
  project.slot_id = p.slot_id || "SLOT_01";
  const nameInput = document.getElementById("txtProjectName");
  const slotInput = document.getElementById("txtSlotId");
  if (nameInput) nameInput.value = project.name;
  if (slotInput) slotInput.value = project.slot_id;

  setMasterVolume(g.master_volume !== undefined ? g.master_volume : 0.8);
  project.bpm = g.bpm || 120;
  project.snap_ms = g.grid_resolution_ms !== undefined ? g.grid_resolution_ms : 25;

  const bpmInput = document.getElementById("numBpm");
  if (bpmInput) bpmInput.value = project.bpm;

  const snapSel = document.getElementById("selSnap");
  if (snapSel) {
    for (const opt of snapSel.options) {
      if (parseInt(opt.value) === project.snap_ms) opt.selected = true;
    }
  }

  // Waveform key to ID mapping
  const waveMap = { "SINE": 0, "SQUARE": 1, "TRIANGLE": 2, "SAWTOOTH": 3, "NOISE": 4 };

  project.layers = (data.layers || []).map((l, idx) => {
    const waveId = typeof l.waveform === "string" ? (waveMap[l.waveform] || 0) : (l.waveform || 0);
    const adsr = l.default_adsr || l.adsr || { attack_ms: 10, decay_ms: 50, sustain: 0.7, release_ms: 100 };
    return {
      layer_id: l.layer_id || (idx + 1),
      name: l.name || "Layer " + (idx + 1),
      waveform: waveId,
      volume: l.volume !== undefined ? l.volume : 0.8,
      mute: !!l.mute,
      solo: !!l.solo,
      adsr: {
        attack_ms: adsr.attack_ms || 10,
        decay_ms: adsr.decay_ms || 50,
        sustain: adsr.sustain !== undefined ? adsr.sustain : (adsr.sustain_level !== undefined ? adsr.sustain_level : 0.7),
        release_ms: adsr.release_ms || 100
      },
      notes: (l.notes || []).map(n => ({
        id: n.id || "n_" + Math.random().toString(36).substr(2, 9),
        frequency_hz: n.frequency_hz,
        start_time_ms: Math.round(n.start_time_ms),
        duration_ms: Math.round(n.duration_ms)
      }))
    };
  });

  if (project.layers.length === 0) {
    project.layers.push({
      layer_id: 1,
      name: "Layer 01",
      waveform: 0,
      volume: 0.8,
      mute: false,
      solo: false,
      adsr: { attack_ms: 10, decay_ms: 50, sustain: 0.7, release_ms: 100 },
      notes: []
    });
  }

  project.activeLayerIndex = 0;
  expandedLayerIndex = 0;
  project.selectedNote = null;
  updateLayersList();
  updateInspector();
  render();
}

// Footer stats update & firmware limits check
function updateFooterStats() {
  const dur = project.totalDurationMs;
  const durEl = document.getElementById("statDuration");
  const notesEl = document.getElementById("statNotes");
  const layersEl = document.getElementById("statLayers");
  if (durEl) durEl.textContent = dur + " ms";
  if (notesEl) notesEl.textContent = project.totalNotesCount;
  if (layersEl) layersEl.textContent = project.layers.length;
}
