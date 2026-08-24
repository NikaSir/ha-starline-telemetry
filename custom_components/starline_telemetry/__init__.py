"""StarLine Telemetry integration and read-only vehicle panel."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryNotReady
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import StarLineApiClient, StarLineApiError, StarLineAuthenticationError
from .const import (
    CONF_APP_ID,
    CONF_APP_SECRET,
    CONF_MODE,
    CONF_PASSWORD_HASH,
    CONF_USERNAME,
    CORE_STARLINE_DOMAIN,
    MODE_CORE_BRIDGE,
    MODE_TELEMETRY,
    PLATFORMS,
)
from .coordinator import StarLineTelemetryCoordinator
from .panel import async_register_native_panel, async_unregister_native_panel


@dataclass(slots=True)
class StarLineRuntimeData:
    """Runtime data for a StarLine config entry."""

    mode: str
    client: StarLineApiClient | None = None
    coordinator: StarLineTelemetryCoordinator | None = None


type StarLineTelemetryConfigEntry = ConfigEntry[StarLineRuntimeData]


async def async_setup_entry(
    hass: HomeAssistant, entry: StarLineTelemetryConfigEntry
) -> bool:
    """Set up StarLine Telemetry or panel bridge from a config entry."""
    mode = str(entry.data.get(CONF_MODE, MODE_TELEMETRY))

    if mode == MODE_CORE_BRIDGE:
        if not hass.config_entries.async_entries(CORE_STARLINE_DOMAIN):
            raise ConfigEntryNotReady(
                "Home Assistant StarLine integration is not configured"
            )
        entry.runtime_data = StarLineRuntimeData(mode=MODE_CORE_BRIDGE)
        await async_register_native_panel(hass, entry)
        return True

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
        hass, entry, client, [device.device_id for device in devices]
    )
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = StarLineRuntimeData(
        mode=MODE_TELEMETRY, client=client, coordinator=coordinator
    )
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await async_register_native_panel(hass, entry)
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: StarLineTelemetryConfigEntry
) -> bool:
    """Unload a StarLine Telemetry config entry."""
    mode = str(entry.data.get(CONF_MODE, MODE_TELEMETRY))
    unload_ok = True
    if mode != MODE_CORE_BRIDGE:
        unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        async_unregister_native_panel(hass, entry)
    return unload_ok
