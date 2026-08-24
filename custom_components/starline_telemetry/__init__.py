"""StarLine Telemetry integration."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry, ConfigEntryAuthFailed, ConfigEntryNotReady
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import StarLineApiClient, StarLineApiError, StarLineAuthenticationError
from .const import (
    CONF_APP_ID,
    CONF_APP_SECRET,
    CONF_PASSWORD_HASH,
    CONF_USERNAME,
    PLATFORMS,
)
from .coordinator import StarLineTelemetryCoordinator


@dataclass(slots=True)
class StarLineRuntimeData:
    """Runtime data for a StarLine config entry."""

    client: StarLineApiClient
    coordinator: StarLineTelemetryCoordinator


type StarLineTelemetryConfigEntry = ConfigEntry[StarLineRuntimeData]


async def async_setup_entry(
    hass: HomeAssistant, entry: StarLineTelemetryConfigEntry
) -> bool:
    """Set up StarLine Telemetry from a config entry."""
    client = StarLineApiClient(
        async_get_clientsession(hass),
        str(entry.data[CONF_APP_ID]),
        str(entry.data[CONF_APP_SECRET]),
        str(entry.data[CONF_USERNAME]),
        str(entry.data[CONF_PASSWORD_HASH]),
    )

    try:
        await client.async_authenticate()
        devices = await client.async_get_devices()
    except StarLineAuthenticationError as err:
        raise ConfigEntryAuthFailed("StarLine authentication failed") from err
    except StarLineApiError as err:
        raise ConfigEntryNotReady(str(err)) from err

    if not devices:
        raise ConfigEntryNotReady("No StarLine devices were returned by the account")

    coordinator = StarLineTelemetryCoordinator(
        hass, client, [device.device_id for device in devices]
    )
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = StarLineRuntimeData(client=client, coordinator=coordinator)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: StarLineTelemetryConfigEntry
) -> bool:
    """Unload a StarLine Telemetry config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
