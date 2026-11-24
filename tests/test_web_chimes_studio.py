"""Automated validation tests for ESP32 System Chimes Web Studio."""

import re
import unittest
from pathlib import Path

STUDIO_HTML = Path(__file__).resolve().parents[1] / "tools-web" / "chimes_studio.html"


class TestWebChimesStudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = STUDIO_HTML.read_text(encoding="utf-8")

    def test_file_exists_and_non_empty(self):
        self.assertTrue(STUDIO_HTML.is_file(), "chimes_studio.html must exist")
        self.assertGreater(STUDIO_HTML.stat().st_size, 50000, "Studio HTML should contain presets and full DAW engine")

    def test_zero_external_dependencies(self):
        scripts = re.findall(r'<script\b[^>]*src=["\']([^"\']+)["\']', self.html, re.IGNORECASE)
        styles = re.findall(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\']', self.html, re.IGNORECASE)
        self.assertEqual(scripts, [], f"Found external scripts: {scripts}")
        self.assertEqual(styles, [], f"Found external stylesheets: {styles}")
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
            'id="btnStop"',
            'id="btnAddLayer"',
            'id="btnUploadSlot"',
            'id="btnQuerySlots"',
            'id="btnPlayDevice"',
            'id="btnStopDevice"',
            'id="btnCopyCode"',
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

    def test_web_audio_and_serial_apis(self):
        self.assertIn("AudioContext", self.html)
        self.assertIn("navigator.serial", self.html)
        self.assertIn("createOscillator", self.html)
        self.assertIn("createGain", self.html)
        self.assertIn("linearRampToValueAtTime", self.html)


if __name__ == "__main__":
    unittest.main()
