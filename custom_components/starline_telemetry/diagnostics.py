"""Diagnostics support for StarLine Telemetry."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import StarLineTelemetryConfigEntry
from .const import CONF_APP_SECRET, CONF_PASSWORD_HASH

_TO_REDACT_CONFIG = {CONF_APP_SECRET, CONF_PASSWORD_HASH}
_TO_REDACT_TELEMETRY = {
    "telephone",
    "phone",
    "imei",
    "sn",
    "x",
    "y",
    "latitude",
    "longitude",
}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: StarLineTelemetryConfigEntry
) -> dict[str, Any]:
    """Return redacted diagnostics for a config entry."""
    coordinator = entry.runtime_data.coordinator
    return {
        "entry": async_redact_data(dict(entry.data), _TO_REDACT_CONFIG),
        "update_interval_seconds": (
            coordinator.update_interval.total_seconds()
            if coordinator.update_interval is not None
            else None
        ),
        "device_count": len(coordinator.device_ids),
        "telemetry": async_redact_data(coordinator.data, _TO_REDACT_TELEMETRY),
    }
