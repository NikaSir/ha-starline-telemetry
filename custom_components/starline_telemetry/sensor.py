"""Sensor platform for StarLine Telemetry."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorEntityDescription
from homeassistant.const import PERCENTAGE, UnitOfElectricPotential, UnitOfLength, UnitOfTemperature, UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import StarLineTelemetryConfigEntry
from .entity import StarLineTelemetryEntity, has_nested_value, nested_value


@dataclass(frozen=True, kw_only=True)
class StarLineSensorDescription(SensorEntityDescription):
    """Describe a StarLine sensor."""

    path: tuple[str, ...]
    value_fn: Callable[[Any], Any] | None = None


SENSORS: tuple[StarLineSensorDescription, ...] = (
    StarLineSensorDescription(
        key="battery",
        translation_key="battery",
        path=("common", "battery"),
    ),
    StarLineSensorDescription(
        key="cabin_temperature",
        translation_key="cabin_temperature",
        path=("common", "ctemp"),
        device_class=SensorDeviceClass.TEMPERATURE,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
    ),
    StarLineSensorDescription(
        key="engine_temperature",
        translation_key="engine_temperature",
        path=("common", "etemp"),
        device_class=SensorDeviceClass.TEMPERATURE,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
    ),
    StarLineSensorDescription(
        key="gps_satellites",
        translation_key="gps_satellites",
        path=("common", "gps_lvl"),
        native_unit_of_measurement="satellites",
    ),
    StarLineSensorDescription(
        key="gsm_level",
        translation_key="gsm_level",
        path=("common", "gsm_lvl"),
    ),
    StarLineSensorDescription(
        key="fuel_percent",
        translation_key="fuel_percent",
        path=("obd", "fuel_percent"),
        native_unit_of_measurement=PERCENTAGE,
    ),
    StarLineSensorDescription(
        key="fuel_litres",
        translation_key="fuel_litres",
        path=("obd", "fuel_litres"),
        device_class=SensorDeviceClass.VOLUME_STORAGE,
        native_unit_of_measurement=UnitOfVolume.LITERS,
    ),
    StarLineSensorDescription(
        key="odometer",
        translation_key="odometer",
        path=("obd", "mileage"),
        device_class=SensorDeviceClass.DISTANCE,
        native_unit_of_measurement=UnitOfLength.KILOMETERS,
    ),
    StarLineSensorDescription(
        key="last_activity",
        translation_key="last_activity",
        path=("activity_ts",),
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda value: datetime.fromtimestamp(float(value), tz=UTC),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: StarLineTelemetryConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up StarLine sensors."""
    coordinator = entry.runtime_data.coordinator
    entities: list[SensorEntity] = []
    for device_id, data in coordinator.data.items():
        for description in SENSORS:
            if has_nested_value(data, description.path):
                entities.append(StarLineTelemetrySensor(coordinator, device_id, description))
    async_add_entities(entities)


class StarLineTelemetrySensor(StarLineTelemetryEntity, SensorEntity):
    """A StarLine telemetry sensor."""

    entity_description: StarLineSensorDescription

    def __init__(self, coordinator, device_id: int, description: StarLineSensorDescription) -> None:
        super().__init__(coordinator, device_id, description.key)
        self.entity_description = description

    @property
    def native_value(self) -> Any:
        """Return the current sensor value."""
        value = nested_value(self.device_data, self.entity_description.path)
        if self.entity_description.value_fn is not None:
            return self.entity_description.value_fn(value)
        return value

    @property
    def device_class(self) -> SensorDeviceClass | None:
        """Return dynamic battery device class when applicable."""
        if self.entity_description.key == "battery":
            battery_type = self.device_data.get("common", {}).get("battery_type")
            return (
                SensorDeviceClass.VOLTAGE
                if battery_type == "volt"
                else SensorDeviceClass.BATTERY
                if battery_type == "percent"
                else None
            )
        return self.entity_description.device_class

    @property
    def native_unit_of_measurement(self) -> str | None:
        """Return dynamic battery unit when applicable."""
        if self.entity_description.key == "battery":
            battery_type = self.device_data.get("common", {}).get("battery_type")
            if battery_type == "volt":
                return UnitOfElectricPotential.VOLT
            if battery_type == "percent":
                return PERCENTAGE
            return None
        return self.entity_description.native_unit_of_measurement
