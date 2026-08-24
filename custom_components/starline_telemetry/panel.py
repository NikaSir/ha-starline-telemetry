"""Native StarLine panel backed by existing Home Assistant entities."""

from __future__ import annotations

import logging
from pathlib import Path
import re
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er

from .const import (
    CORE_STARLINE_DOMAIN,
    DOMAIN,
    PANEL_ICON,
    PANEL_PARENT_ROUTE,
    PANEL_PREFERRED_VIEW,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_VERSION,
)

_LOGGER = logging.getLogger(__name__)

PANEL_STATIC_URL = f"/{DOMAIN}_static"
PANEL_COMPONENT = "starline-app-panel-v002"
PANEL_MODULE = f"{PANEL_STATIC_URL}/starline-app-v002.js?v={PANEL_VERSION}"

_DATA_PANEL_REGISTERED = "native_panel_registered"
_DATA_STATIC_REGISTERED = "native_panel_static_registered"
_DATA_WS_REGISTERED = "native_panel_ws_registered"
_DATA_PANEL_ENTRY_ID = "native_panel_entry_id"

_CORE_UNIQUE_ID = re.compile(r"^starline-(?P<key>.+)-(?P<device_id>\d+)$")
_TELEMETRY_UNIQUE_ID = re.compile(r"^(?P<device_id>\d+)_(?P<key>.+)$")


def _vehicle_bucket(vehicles: dict[str, dict[str, Any]], device_id: str) -> dict[str, Any]:
    return vehicles.setdefault(
        device_id,
        {
            "device_id": device_id,
            "device_registry_id": None,
            "name": f"StarLine {device_id}",
            "manufacturer": "StarLine",
            "model": None,
            "entities": {},
            "sources": {},
        },
    )


def _apply_device_metadata(
    hass: HomeAssistant, bucket: dict[str, Any], registry_device_id: str | None
) -> None:
    if not registry_device_id:
        return
    bucket["device_registry_id"] = registry_device_id
    device = dr.async_get(hass).async_get(registry_device_id)
    if device is None:
        return
    bucket["name"] = device.name_by_user or device.name or bucket["name"]
    bucket["manufacturer"] = device.manufacturer or bucket["manufacturer"]
    bucket["model"] = device.model


def _discover_vehicle_entities(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Resolve core StarLine and future integration-owned entities by unique_id."""
    registry = er.async_get(hass)
    vehicles: dict[str, dict[str, Any]] = {}

    # Existing Home Assistant core StarLine integration. This is the active source
    # during bridge mode and remains a fallback after our own telemetry is ready.
    for registry_entry in registry.entities.values():
        if registry_entry.platform != CORE_STARLINE_DOMAIN:
            continue
        match = _CORE_UNIQUE_ID.match(registry_entry.unique_id)
        if match is None:
            continue
        device_id = match.group("device_id")
        key = match.group("key")
        bucket = _vehicle_bucket(vehicles, device_id)
        bucket["entities"][key] = registry_entry.entity_id
        bucket["sources"][key] = "core_starline"
        _apply_device_metadata(hass, bucket, registry_entry.device_id)

    # Future migration path: integration-owned telemetry wins role-by-role without
    # changing the UI contract or user-renamed entity_id values.
    for registry_entry in registry.entities.values():
        if registry_entry.platform != DOMAIN:
            continue
        match = _TELEMETRY_UNIQUE_ID.match(registry_entry.unique_id)
        if match is None:
            continue
        device_id = match.group("device_id")
        key = match.group("key")
        bucket = _vehicle_bucket(vehicles, device_id)
        bucket["entities"][key] = registry_entry.entity_id
        bucket["sources"][key] = "starline_telemetry"
        _apply_device_metadata(hass, bucket, registry_entry.device_id)

    return sorted(vehicles.values(), key=lambda item: (str(item["name"]), item["device_id"]))


def _bootstrap_payload(hass: HomeAssistant, entry: ConfigEntry | None) -> dict[str, Any]:
    vehicles = _discover_vehicle_entities(hass)
    core_entries = hass.config_entries.async_entries(CORE_STARLINE_DOMAIN)
    telemetry_entries = hass.config_entries.async_entries(DOMAIN)
    return {
        "panel": {
            "id": "starline",
            "title": PANEL_TITLE,
            "path": f"/{PANEL_URL_PATH}",
            "icon": PANEL_ICON,
            "parent_route": PANEL_PARENT_ROUTE,
            "preferred_view": PANEL_PREFERRED_VIEW,
            "version": PANEL_VERSION,
            "read_only": True,
        },
        "source": {
            "primary": "starline_telemetry" if any(
                "starline_telemetry" in vehicle["sources"].values()
                for vehicle in vehicles
            ) else "core_starline",
            "core_entries": len(core_entries),
            "telemetry_entries": len(telemetry_entries),
            "bridge_entry_id": entry.entry_id if entry is not None else None,
        },
        "vehicles": vehicles,
    }


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/panel/bootstrap",
        vol.Optional("entry_id"): str,
    }
)
@callback
def websocket_panel_bootstrap(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return current StarLine entity mapping for the native panel."""
    entry_id = msg.get("entry_id")
    entry = hass.config_entries.async_get_entry(entry_id) if entry_id else None
    connection.send_result(msg["id"], _bootstrap_payload(hass, entry))


async def async_register_native_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Register the native read-only StarLine panel."""
    domain_data = hass.data.setdefault(DOMAIN, {})

    if not domain_data.get(_DATA_WS_REGISTERED):
        websocket_api.async_register_command(hass, websocket_panel_bootstrap)
        domain_data[_DATA_WS_REGISTERED] = True

    if not domain_data.get(_DATA_STATIC_REGISTERED):
        frontend_dir = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_STATIC_URL, str(frontend_dir), cache_headers=False)]
        )
        domain_data[_DATA_STATIC_REGISTERED] = True

    if domain_data.get(_DATA_PANEL_REGISTERED):
        return

    if frontend.async_panel_exists(hass, PANEL_URL_PATH):
        _LOGGER.error(
            "Cannot register StarLine panel: /%s is already used by another panel",
            PANEL_URL_PATH,
        )
        return

    try:
        await panel_custom.async_register_panel(
            hass=hass,
            frontend_url_path=PANEL_URL_PATH,
            webcomponent_name=PANEL_COMPONENT,
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=PANEL_MODULE,
            embed_iframe=False,
            require_admin=False,
            handle_safe_area=True,
            config={
                "entry_id": entry.entry_id,
                "panel_version": PANEL_VERSION,
                "parent_route": PANEL_PARENT_ROUTE,
                "preferred_view": PANEL_PREFERRED_VIEW,
                "bootstrap_fallback": _bootstrap_payload(hass, entry),
            },
        )
    except ValueError as err:
        _LOGGER.error("Unable to register StarLine native panel: %s", err)
        return

    domain_data[_DATA_PANEL_ENTRY_ID] = entry.entry_id
    domain_data[_DATA_PANEL_REGISTERED] = True


@callback
def async_unregister_native_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Remove the panel when its owning config entry is unloaded."""
    domain_data = hass.data.get(DOMAIN, {})
    if domain_data.get(_DATA_PANEL_ENTRY_ID) != entry.entry_id:
        return
    if domain_data.get(_DATA_PANEL_REGISTERED) and frontend.async_panel_exists(
        hass, PANEL_URL_PATH
    ):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    domain_data[_DATA_PANEL_REGISTERED] = False
