"""Regression checks for the StarLine panel startup lifecycle."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "custom_components/starline_telemetry/__init__.py").read_text(
    encoding="utf-8"
)


class StartupLifecycleContractTest(unittest.TestCase):
    """Keep the application route independent of fallible source startup."""

    def test_bridge_route_precedes_dependency_check(self) -> None:
        """A missing core integration must not own panel availability."""
        start = SOURCE.index("if mode == MODE_CORE_BRIDGE:")
        end = SOURCE.index("client = StarLineApiClient", start)
        bridge = SOURCE[start:end]

        runtime = bridge.index("entry.runtime_data = StarLineRuntimeData")
        registration = bridge.index("await async_register_native_panel")
        dependency = bridge.index("if not hass.config_entries.async_entries")

        self.assertLess(runtime, registration)
        self.assertLess(registration, dependency)

    def test_telemetry_route_precedes_cloud_io_and_first_refresh(self) -> None:
        """Authentication and telemetry failures must not remove the route."""
        telemetry = SOURCE[SOURCE.index("client = StarLineApiClient") :]

        runtime = telemetry.index("entry.runtime_data = StarLineRuntimeData")
        registration = telemetry.index("await async_register_native_panel")
        authentication = telemetry.index("await client.async_authenticate")
        discovery = telemetry.index("await client.async_get_devices")
        first_refresh = telemetry.index("await coordinator.async_config_entry_first_refresh")
        platforms = telemetry.index("async_forward_entry_setups")

        self.assertLess(runtime, registration)
        self.assertLess(registration, authentication)
        self.assertLess(authentication, discovery)
        self.assertLess(discovery, first_refresh)
        self.assertLess(first_refresh, platforms)

    def test_setup_never_unregisters_the_panel(self) -> None:
        """Only the successful unload path may release route ownership."""
        setup, unload = SOURCE.split("async def async_unload_entry", maxsplit=1)

        self.assertNotIn("async_unregister_native_panel(hass, entry)", setup)
        self.assertIn("if unload_ok:", unload)
        self.assertIn("async_unregister_native_panel(hass, entry)", unload)


if __name__ == "__main__":
    unittest.main()
