"""Automated validation tests for ESP32 System Chimes Web Studio."""

import re
import unittest
from pathlib import Path

STUDIO_HTML = Path(__file__).resolve().parents[1] / "tools-web" / "index.html"


class TestWebChimesStudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = STUDIO_HTML.read_text(encoding="utf-8")
        cls.assets = sorted(
            path
            for folder in ("css", "js")
            for path in (STUDIO_HTML.parent / folder).glob("*")
            if path.is_file()
        )
        cls.html = cls.page + "\n" + "\n".join(
            path.read_text(encoding="utf-8") for path in cls.assets
        )

    def test_file_exists_and_non_empty(self):
        self.assertTrue(STUDIO_HTML.is_file(), "tools-web/index.html must exist")
        total_size = STUDIO_HTML.stat().st_size + sum(path.stat().st_size for path in self.assets)
        self.assertGreater(total_size, 50000, "Studio assets should contain presets and full DAW engine")

    def test_zero_external_dependencies(self):
        scripts = re.findall(r'<script\b[^>]*src=["\']([^"\']+)["\']', self.page, re.IGNORECASE)
        styles = re.findall(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\']', self.page, re.IGNORECASE)
        self.assertTrue(scripts, "Expected local JavaScript modules")
        self.assertTrue(styles, "Expected local stylesheets")
        for asset in scripts + styles:
            self.assertFalse(asset.startswith(("http://", "https://")), f"External asset: {asset}")
            self.assertTrue((STUDIO_HTML.parent / asset).is_file(), f"Missing local asset: {asset}")
        self.assertNotIn("https://", self.html)
        self.assertNotIn("http://", self.html)

    def test_firmware_handshake_and_protocol(self):
        self.assertIn("ESP32_SYSTEM_CHIMES_V2", self.html)
        for cmd in ("TOOL_ID", "QUERY_SLOTS", "GET_SLOT", "UPLOAD", "PLAY", "STOP", "SET_VOLUME", "GET_VOLUME", "DELETE", "ERASE_ALL"):
            self.assertIn(cmd, self.html, f"Missing protocol command {cmd}")

    def test_waveform_definitions(self):
        for wave in ("SINE", "SQUARE", "TRIANGLE", "SAWTOOTH", "NOISE"):
            self.assertIn(wave, self.html, f"Missing waveform {wave}")

    def test_bundled_presets_presence(self):
        presets = [
            "Attention Pulse",
            "Low Battery",
            "Hourly Clock Chime",
            "Critical Temperature",
            "Low Confirm",
            "Network Connected",
            "Network Disconnected",
            "Original Retro Puzzle Melody",
            "Success Chime",
            "Temperature Warning",
            "UI Select",
            "Wake Alarm Cue",
        ]
        for p in presets:
            self.assertIn(p, self.html, f"Missing bundled preset {p}")

    def test_core_ui_elements(self):
        elements = [
            'id="pianoCanvas"',
            'id="adsrCanvas"',
            'id="btnConnect"',
            'id="btnPlay"',
            'id="btnAddLayer"',
            'id="btnUploadSlot"',
            'id="btnQuerySlots"',
            'id="btnPlayDevice"',
            'id="btnStopDevice"',
            'id="btnExport"',
            'id="btnImport"',
            'id="btnNew"',
            'id="selPresets"',
            'id="txtSlotId"',
            'id="txtProjectName"',
            'id="rngMasterVol"',
            'id="selSnap"',
            'id="numBpm"',
        ]
        for elem in elements:
            self.assertIn(elem, self.html, f"Missing DOM element {elem}")
        self.assertNotIn('id="btnStop"', self.page, "Playback uses one play/stop toggle")
        header_actions = [
            self.page.index('id="btnConnect"'),
            self.page.index('id="btnToggleTerm"'),
            self.page.index('id="btnHelp"'),
        ]
        self.assertEqual(header_actions, sorted(header_actions), "Header actions follow connect, terminal, help order")
        transport_actions = [
            self.page.index('id="btnPlay"'),
            self.page.index('id="btnNew"'),
            self.page.index('id="btnImport"'),
            self.page.index('id="btnExport"'),
            self.page.index('id="btnUploadSlot"'),
            self.page.index('id="numBpm"'),
        ]
        self.assertEqual(transport_actions, sorted(transport_actions), "Transport toolbar follows play, new, import, export, upload, bpm order")
        self.assertIn('data-tooltip="New project" aria-label="New project"', self.page)
        self.assertIn('data-tooltip="Import JSON" aria-label="Import JSON"', self.page)
        self.assertIn('data-tooltip="Export JSON" aria-label="Export JSON"', self.page)
        self.assertLess(self.page.index('id="selSnap"'), self.page.index('id="rngMasterVol"'))
        self.assertGreater(self.page.index('id="selSnap"'), self.page.index('id="btnExport"'))
        self.assertLess(self.page.index('id="rngHwVol"'), self.page.index('id="tabHw"'))
        self.assertIn('id="btnMuteHwVol"', self.page)
        self.assertIn('id="btnMuteMasterVol"', self.page)
        self.assertIn('id="masterVolIconOn"', self.page)
        self.assertIn('id="masterVolIconMuted"', self.page)
        self.assertIn('id="stopIcon"', self.page)
        self.assertIn('aria-label="ESP32 hardware output volume"', self.page)
        self.assertIn('aria-label="PC preview master volume"', self.page)
        self.assertIn('data-tooltip="Mute ESP32 output"', self.page)
        self.assertIn('data-tooltip="Mute PC preview"', self.page)
        self.assertNotIn('<label for="rngMasterVol">', self.page)
        self.assertIn('setMasterVolume(masterVolumeMuted ? lastMasterVolume : 0)', self.html)
        self.assertIn('setMasterVolume(g.master_volume !== undefined ? g.master_volume : 0.8)', self.html)
        self.assertIn('applyPreviewMasterVolume(volume)', self.html)
        self.assertIn('gain.connect(masterGainNode)', self.html)
        self.assertIn("setPlaybackButtonState(true)", self.html)
        self.assertIn('sendSerialCommand("SET_VOLUME " + vol.toFixed(3))', self.html)
        self.assertNotIn('data-tab="tabCode"', self.page)
        self.assertNotIn('id="tabCode"', self.page)
        self.assertNotIn("C Struct Generator", self.html)
        self.assertNotIn("updateCPreview", self.html)
        self.assertNotIn("code-generator.js", self.page)
        self.assertIn('src="js/project-files.js"', self.page)

    def test_serial_console_actions_and_unknown_hardware_state(self):
        for elem in ('id="btnToggleTerm"', 'id="btnCopyLog"', 'id="btnDownloadLog"', 'id="btnClearLog"', 'id="btnCloseTerm"', 'id="cmdInput"'):
            self.assertIn(elem, self.page, f"Missing serial console control {elem}")
        self.assertIn("Serial Console", self.page)
        self.assertIn('placeholder="Type a command and press Enter..."', self.page)
        self.assertIn('id="btnSendCmd" type="button" data-tooltip="Send command" aria-label="Send command"', self.page)
        self.assertIn('id="termBox" role="log" aria-label="Serial output" aria-live="polite"', self.page)
        self.assertIn('class="status-bar"', self.page)
        self.assertIn('id="statusBadge"', self.page)
        self.assertIn('id="help-dialog"', self.page)
        self.assertNotIn('id="tabLog"', self.page)
        self.assertNotIn('id="terminalLog"', self.html)
        self.assertIn(">Not queried</span>", self.page)
        self.assertIn('id="rngHwVol" min="0" max="1" step="0.05" value="0" disabled', self.page)
        self.assertIn('id="btnMuteHwVol"', self.page)
        self.assertIn('id="txtHwVol">-</span>', self.page)
        self.assertIn('sendSerialCommand("TOOL_ID", true)', self.html)
        self.assertIn("ESP32 System Chimes firmware has not been verified.", self.html)

    def test_web_audio_and_serial_apis(self):
        self.assertIn("AudioContext", self.html)
        self.assertIn("navigator.serial", self.html)
        self.assertIn("createOscillator", self.html)
        self.assertIn("createGain", self.html)
        self.assertIn("linearRampToValueAtTime", self.html)


if __name__ == "__main__":
    unittest.main()
