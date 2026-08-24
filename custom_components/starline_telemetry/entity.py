"""Base entities for StarLine Telemetry."""

from __future__ import annotations

from typing import Any

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import StarLineTelemetryCoordinator

_MISSING = object()


def nested_value(data: dict[str, Any], path: tuple[str, ...]) -> Any:
    """Get a nested dictionary value, returning a private sentinel when absent."""
    value: Any = data
    for key in path:
        if not isinstance(value, dict) or key not in value:
            return _MISSING
        value = value[key]
    return value


def has_nested_value(data: dict[str, Any], path: tuple[str, ...]) -> bool:
    """Return whether a nested telemetry field exists and is not null."""
    value = nested_value(data, path)
    return value is not _MISSING and value is not None


class StarLineTelemetryEntity(CoordinatorEntity[StarLineTelemetryCoordinator]):
    """Base class for StarLine telemetry entities."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: StarLineTelemetryCoordinator,
        device_id: int,
        entity_key: str,
    ) -> None:
        super().__init__(coordinator)
        self.device_id = device_id
        self._attr_unique_id = f"{device_id}_{entity_key}"

    @property
    def device_data(self) -> dict[str, Any]:
        """Return the current device snapshot."""
        return self.coordinator.data.get(self.device_id, {})

    @property
    def device_info(self) -> DeviceInfo:
        """Return Home Assistant device information."""
        data = self.device_data
        return DeviceInfo(
            identifiers={(DOMAIN, str(self.device_id))},
            name=str(data.get("alias") or f"StarLine {self.device_id}"),
            manufacturer="StarLine",
            model=str(data.get("typename") or "StarLine telematics"),
            sw_version=(
                str(data["firmware_version"])
                if data.get("firmware_version") is not None
                else None
            ),
            serial_number=(str(data["sn"]) if data.get("sn") else None),
        )
