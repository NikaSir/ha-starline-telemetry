"""Binary sensor platform for StarLine Telemetry."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import StarLineTelemetryConfigEntry
from .entity import StarLineTelemetryEntity, has_nested_value, nested_value


@dataclass(frozen=True, kw_only=True)
class StarLineBinarySensorDescription(BinarySensorEntityDescription):
    """Describe a StarLine binary sensor."""

    path: tuple[str, ...]


BINARY_SENSORS: tuple[StarLineBinarySensorDescription, ...] = (
    StarLineBinarySensorDescription(
        key="armed", translation_key="armed", path=("state", "arm")
    ),
    StarLineBinarySensorDescription(
        key="alarm",
        translation_key="alarm",
        path=("state", "alarm"),
        device_class=BinarySensorDeviceClass.SAFETY,
    ),
    StarLineBinarySensorDescription(
        key="door",
        translation_key="door",
        path=("state", "door"),
        device_class=BinarySensorDeviceClass.DOOR,
    ),
    StarLineBinarySensorDescription(
        key="hood",
        translation_key="hood",
        path=("state", "hood"),
        device_class=BinarySensorDeviceClass.OPENING,
    ),
    StarLineBinarySensorDescription(
        key="trunk",
        translation_key="trunk",
        path=("state", "trunk"),
        device_class=BinarySensorDeviceClass.OPENING,
    ),
    StarLineBinarySensorDescription(
        key="ignition", translation_key="ignition", path=("state", "ign")
    ),
    StarLineBinarySensorDescription(
        key="engine_running", translation_key="engine_running", path=("state", "run")
    ),
    StarLineBinarySensorDescription(
        key="service_mode", translation_key="service_mode", path=("state", "valet")
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: StarLineTelemetryConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up StarLine binary sensors."""
    coordinator = entry.runtime_data.coordinator
    entities: list[BinarySensorEntity] = []
    for device_id, data in coordinator.data.items():
        for description in BINARY_SENSORS:
            if has_nested_value(data, description.path):
                entities.append(
                    StarLineTelemetryBinarySensor(coordinator, device_id, description)
                )
    async_add_entities(entities)


class StarLineTelemetryBinarySensor(StarLineTelemetryEntity, BinarySensorEntity):
    """A StarLine telemetry binary sensor."""

    entity_description: StarLineBinarySensorDescription

    def __init__(self, coordinator, device_id: int, description: StarLineBinarySensorDescription) -> None:
        super().__init__(coordinator, device_id, description.key)
        self.entity_description = description

    @property
    def is_on(self) -> bool:
        """Return the current binary state."""
        return bool(nested_value(self.device_data, self.entity_description.path))
