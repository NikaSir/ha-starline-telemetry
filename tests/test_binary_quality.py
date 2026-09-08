"""Regression checks for three-state StarLine discrete telemetry."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUALITY_PATH = ROOT / "custom_components/starline_telemetry/data_quality.py"


def _load_quality_module():
    spec = importlib.util.spec_from_file_location("starline_data_quality", QUALITY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load StarLine data-quality helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BinaryQualityTest(unittest.TestCase):
    """Missing telemetry is unknown, never an implicit negative state."""

    def test_explicit_values_and_unknown_are_distinct(self) -> None:
        quality = _load_quality_module()
        normalize = quality.normalize_binary_value

        self.assertIs(normalize(True), True)
        self.assertIs(normalize(False), False)
        self.assertIs(normalize(1), True)
        self.assertIs(normalize(0), False)
        self.assertIsNone(normalize(None))
        self.assertIsNone(normalize(""))
        self.assertIsNone(normalize("unknown"))
        self.assertIsNone(normalize("unavailable"))
        self.assertIsNone(normalize(2))
        self.assertIs(normalize(2, legacy_disarmed=True), False)
        self.assertIs(normalize("2", legacy_disarmed=True), False)

    def test_full_then_partial_payload_does_not_invent_false(self) -> None:
        quality = _load_quality_module()
        snapshots = [
            {"state": {"alarm": 1}},
            {"state": {"alarm": 0}},
            {"state": {}},
            {"state": {"alarm": 1}},
        ]

        states = [
            quality.normalize_binary_value(snapshot["state"].get("alarm"))
            for snapshot in snapshots
        ]

        self.assertEqual(states, [True, False, None, True])

    def test_binary_sensor_uses_three_state_normalizer(self) -> None:
        source = (
            ROOT / "custom_components/starline_telemetry/binary_sensor.py"
        ).read_text(encoding="utf-8")

        self.assertIn("def is_on(self) -> bool | None:", source)
        self.assertIn("return normalize_binary_value(", source)


if __name__ == "__main__":
    unittest.main()
