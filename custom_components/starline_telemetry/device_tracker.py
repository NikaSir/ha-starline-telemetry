"""GPS device tracker platform for StarLine Telemetry."""

from __future__ import annotations

from homeassistant.components.device_tracker import TrackerEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import StarLineTelemetryConfigEntry
from .entity import StarLineTelemetryEntity, has_nested_value


async def async_setup_entry(
    hass: HomeAssistant,
    entry: StarLineTelemetryConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up StarLine GPS trackers."""
    coordinator = entry.runtime_data.coordinator
    entities = [
        StarLineTelemetryTracker(coordinator, device_id)
        for device_id, data in coordinator.data.items()
        if has_nested_value(data, ("position", "x"))
        and has_nested_value(data, ("position", "y"))
    ]
    async_add_entities(entities)


class StarLineTelemetryTracker(StarLineTelemetryEntity, TrackerEntity):
    """GPS position reported by a StarLine device."""

    _attr_translation_key = "vehicle_location"

    def __init__(self, coordinator, device_id: int) -> None:
        super().__init__(coordinator, device_id, "vehicle_location")

    @property
    def latitude(self) -> float | None:
        """Return latitude."""
        value = self.device_data.get("position", {}).get("x")
        return float(value) if value is not None else None

    @property
    def longitude(self) -> float | None:
        """Return longitude."""
        value = self.device_data.get("position", {}).get("y")
        return float(value) if value is not None else None

    @property
    def location_accuracy(self) -> int:
        """Return location accuracy in meters."""
        value = self.device_data.get("position", {}).get("r")
        return int(value) if value is not None else 0
