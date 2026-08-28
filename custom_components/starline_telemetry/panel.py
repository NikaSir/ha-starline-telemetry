"""Native StarLine panel backed by existing Home Assistant entities."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
import logging
from pathlib import Path
import re
import time
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import (
    StarLineApiError,
    StarLineAuthenticationError,
    async_fetch_device_data,
    async_fetch_device_events,
    async_fetch_event_descriptions,
)
from .const import (
    CORE_STARLINE_DOMAIN,
    DAILY_HISTORY_REQUEST_BUDGET,
    DOMAIN,
    HISTORY_CACHE_SECONDS,
    HISTORY_FORCE_REFRESH_SECONDS,
    PANEL_ICON,
    PANEL_PARENT_ROUTE,
    PANEL_PREFERRED_VIEW,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_VERSION,
)

_LOGGER = logging.getLogger(__name__)
PANEL_STATIC_URL = f"/{DOMAIN}_static"
PANEL_COMPONENT = "starline-app-panel"
PANEL_MODULE = f"{PANEL_STATIC_URL}/starline-app.js?v={PANEL_VERSION}"
_DATA_PANEL_REGISTERED = "native_panel_registered"
_DATA_STATIC_REGISTERED = "native_panel_static_registered"
_DATA_WS_REGISTERED = "native_panel_ws_registered"
_DATA_PANEL_ENTRY_ID = "native_panel_entry_id"
_DATA_HISTORY_CACHE = "native_panel_history_cache"
_DATA_HISTORY_LOCKS = "native_panel_history_locks"
_DATA_HISTORY_BUDGET = "native_panel_history_budget"
_DATA_EVENT_DESCRIPTIONS = "native_panel_event_descriptions"
_DATA_LIVE_SECURITY_CACHE = "native_panel_live_security_cache"
_LIVE_SECURITY_CACHE_SECONDS = 60
_CORE_UNIQUE_ID = re.compile(r"^starline-(?P<key>.+)-(?P<device_id>\d+)$")
_TELEMETRY_UNIQUE_ID = re.compile(r"^(?P<device_id>\d+)_(?P<key>.+)$")


def _vehicle_bucket(vehicles: dict[str, dict[str, Any]], device_id: str) -> dict[str, Any]:
    return vehicles.setdefault(device_id, {"device_id": device_id, "device_registry_id": None, "name": f"StarLine {device_id}", "manufacturer": "StarLine", "model": None, "entities": {}, "sources": {}})


def _apply_device_metadata(hass: HomeAssistant, bucket: dict[str, Any], registry_device_id: str | None) -> None:
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
    registry = er.async_get(hass)
    vehicles: dict[str, dict[str, Any]] = {}
    for registry_entry in registry.entities.values():
        if registry_entry.platform != CORE_STARLINE_DOMAIN or registry_entry.disabled_by is not None:
            continue
        match = _CORE_UNIQUE_ID.match(registry_entry.unique_id)
        if match is None:
            continue
        device_id, key = match.group("device_id"), match.group("key")
        bucket = _vehicle_bucket(vehicles, device_id)
        bucket["entities"][key] = registry_entry.entity_id
        bucket["sources"][key] = "core_starline"
        _apply_device_metadata(hass, bucket, registry_entry.device_id)
    for registry_entry in registry.entities.values():
        if registry_entry.platform != DOMAIN or registry_entry.disabled_by is not None:
            continue
        match = _TELEMETRY_UNIQUE_ID.match(registry_entry.unique_id)
        if match is None:
            continue
        device_id, key = match.group("device_id"), match.group("key")
        bucket = _vehicle_bucket(vehicles, device_id)
        bucket["entities"][key] = registry_entry.entity_id
        bucket["sources"][key] = "starline_telemetry"
        _apply_device_metadata(hass, bucket, registry_entry.device_id)
    return sorted(vehicles.values(), key=lambda item: (str(item["name"]), item["device_id"]))


def _bootstrap_payload(hass: HomeAssistant, entry: ConfigEntry | None) -> dict[str, Any]:
    vehicles = _discover_vehicle_entities(hass)
    return {"panel": {"id": "starline", "title": PANEL_TITLE, "path": f"/{PANEL_URL_PATH}", "icon": PANEL_ICON, "parent_route": PANEL_PARENT_ROUTE, "preferred_view": PANEL_PREFERRED_VIEW, "version": PANEL_VERSION, "read_only": True}, "source": {"primary": "starline_telemetry" if any("starline_telemetry" in vehicle["sources"].values() for vehicle in vehicles) else "core_starline", "core_entries": len(hass.config_entries.async_entries(CORE_STARLINE_DOMAIN)), "telemetry_entries": len(hass.config_entries.async_entries(DOMAIN)), "bridge_entry_id": entry.entry_id if entry is not None else None}, "vehicles": vehicles}


def _normalize_arm(value: Any) -> bool | None:
    """Normalize current StarLine arm values from boolean and legacy payloads."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value in (0, 2):
            return False
        return None
    raw = str(value or "").strip().lower()
    if raw in {"1", "on", "true", "locked", "armed"}:
        return True
    if raw in {"0", "2", "off", "false", "unlocked", "disarmed"}:
        return False
    return None


def _core_runtime_device(hass: HomeAssistant, device_id: str):
    """Return the official core StarLine runtime device when available."""
    for entry in hass.config_entries.async_entries(CORE_STARLINE_DOMAIN):
        account = getattr(entry, "runtime_data", None)
        api = getattr(account, "api", None)
        for device in getattr(api, "devices", {}).values():
            if str(getattr(device, "device_id", "")) == device_id:
                return account, device
    return None, None


async def _live_security_state(
    hass: HomeAssistant, device_id: str, force: bool
) -> dict[str, Any]:
    """Read authoritative current security state without exposing credentials."""
    cache = _history_domain_data(hass).setdefault(_DATA_LIVE_SECURITY_CACHE, {})
    cached = cache.get(device_id)
    if not force and isinstance(cached, dict):
        age = time.monotonic() - float(cached.get("loaded_at", 0))
        if age < _LIVE_SECURITY_CACHE_SECONDS:
            return {**cached["payload"], "cached": True}

    async with _history_lock(hass, f"live_security:{device_id}"):
        cached = cache.get(device_id)
        if not force and isinstance(cached, dict):
            age = time.monotonic() - float(cached.get("loaded_at", 0))
            if age < _LIVE_SECURITY_CACHE_SECONDS:
                return {**cached["payload"], "cached": True}

        source = "unavailable"
        arm: bool | None = None
        client = _telemetry_client_for_device(hass, device_id)
        if client is not None:
            try:
                data = await client.async_get_device_data(int(device_id))
            except StarLineAuthenticationError:
                await client.async_authenticate()
                data = await client.async_get_device_data(int(device_id))
            arm = _normalize_arm(data.get("state", {}).get("arm"))
            source = "starline_open_api"
        else:
            account, device = _core_runtime_device(hass, device_id)
            if force and account is not None:
                try:
                    await account.update()
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("Unable to refresh core StarLine state: %s", err)
            if force and device is not None:
                arm = _normalize_arm(getattr(device, "car_state", {}).get("arm"))
                source = "core_starline_runtime"
            elif token := _core_token_for_device(hass, device_id):
                try:
                    data = await async_fetch_device_data(
                        async_get_clientsession(hass), token, device_id
                    )
                    arm = _normalize_arm(data.get("state", {}).get("arm"))
                    source = "starline_open_api"
                except StarLineApiError as err:
                    _LOGGER.warning("Unable to read current StarLine security: %s", err)
            if arm is None and device is not None:
                arm = _normalize_arm(getattr(device, "car_state", {}).get("arm"))
                source = "core_starline_runtime"

        payload = {
            "arm": arm,
            "source": source,
            "fetched_at": datetime.now(UTC).isoformat(),
            "cached": False,
        }
        cache[device_id] = {"loaded_at": time.monotonic(), "payload": payload}
        return payload


async def _bootstrap_payload_live(
    hass: HomeAssistant, entry: ConfigEntry | None, force: bool
) -> dict[str, Any]:
    """Build panel bootstrap with current read-only security snapshots."""
    payload = _bootstrap_payload(hass, entry)
    vehicles = payload["vehicles"]
    security = await asyncio.gather(
        *(
            _live_security_state(hass, str(vehicle["device_id"]), force)
            for vehicle in vehicles
        ),
        return_exceptions=True,
    )
    for vehicle, result in zip(vehicles, security, strict=True):
        if isinstance(result, Exception):
            _LOGGER.warning("Unable to load live StarLine security: %s", result)
            continue
        vehicle["live_security"] = result
    return payload


def _history_domain_data(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.setdefault(DOMAIN, {})


def _history_lock(hass: HomeAssistant, key: str) -> asyncio.Lock:
    locks = _history_domain_data(hass).setdefault(_DATA_HISTORY_LOCKS, {})
    return locks.setdefault(key, asyncio.Lock())


def _consume_history_budget(hass: HomeAssistant) -> None:
    domain_data = _history_domain_data(hass)
    today = datetime.now(UTC).date().isoformat()
    budget = domain_data.setdefault(_DATA_HISTORY_BUDGET, {"day": today, "used": 0})
    if budget.get("day") != today:
        budget.update({"day": today, "used": 0})
    if int(budget.get("used", 0)) >= DAILY_HISTORY_REQUEST_BUDGET:
        raise StarLineApiError("StarLine history request budget is exhausted for today")
    budget["used"] = int(budget.get("used", 0)) + 1


async def _event_descriptions(hass: HomeAssistant) -> dict[int, str]:
    domain_data = _history_domain_data(hass)
    cached = domain_data.get(_DATA_EVENT_DESCRIPTIONS)
    if isinstance(cached, dict) and cached:
        return cached
    async with _history_lock(hass, "event_descriptions"):
        cached = domain_data.get(_DATA_EVENT_DESCRIPTIONS)
        if isinstance(cached, dict) and cached:
            return cached
        descriptions = await async_fetch_event_descriptions(
            async_get_clientsession(hass)
        )
        domain_data[_DATA_EVENT_DESCRIPTIONS] = descriptions
        return descriptions


def _telemetry_client_for_device(hass: HomeAssistant, device_id: str):
    for entry in hass.config_entries.async_entries(DOMAIN):
        runtime = getattr(entry, "runtime_data", None)
        client = getattr(runtime, "client", None)
        coordinator = getattr(runtime, "coordinator", None)
        device_ids = getattr(coordinator, "device_ids", ())
        if client is not None and any(str(item) == device_id for item in device_ids):
            return client
    return None


def _core_token_for_device(hass: HomeAssistant, device_id: str) -> str | None:
    for entry in hass.config_entries.async_entries(CORE_STARLINE_DOMAIN):
        account = getattr(entry, "runtime_data", None)
        api = getattr(account, "api", None)
        devices = getattr(api, "devices", {})
        if not any(str(item) == device_id for item in devices):
            continue
        token = entry.data.get("slnet_token")
        if token:
            return str(token)
    return None


async def _read_starline_event_rows(
    hass: HomeAssistant,
    device_id: str,
    period_start: int,
    period_end: int,
) -> list[dict[str, Any]]:
    if client := _telemetry_client_for_device(hass, device_id):
        try:
            return await client.async_get_device_events(
                int(device_id), period_start, period_end
            )
        except StarLineAuthenticationError:
            await client.async_authenticate()
            return await client.async_get_device_events(
                int(device_id), period_start, period_end
            )

    if token := _core_token_for_device(hass, device_id):
        return await async_fetch_device_events(
            async_get_clientsession(hass),
            token,
            device_id,
            period_start,
            period_end,
        )

    raise StarLineApiError("No StarLine read-only history token is available")


def _normalize_starline_events(
    rows: list[dict[str, Any]],
    descriptions: dict[int, str],
    period_start: int,
    period_end: int,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for item in rows:
        try:
            timestamp = int(item.get("timestamp", item.get("ts")))
            event_id = int(item.get("type", item.get("event_id")))
        except (TypeError, ValueError):
            continue
        if timestamp < period_start or timestamp > period_end:
            continue
        group_raw = item.get("groupId", item.get("group_id"))
        try:
            group_id = int(group_raw) if group_raw is not None else None
        except (TypeError, ValueError):
            group_id = None
        events.append(
            {
                "timestamp": timestamp,
                "event_id": event_id,
                "group_id": group_id,
                "description": descriptions.get(
                    event_id, f"Событие StarLine #{event_id}"
                ),
            }
        )
    return sorted(events, key=lambda item: item["timestamp"], reverse=True)[:200]


async def _starline_history(
    hass: HomeAssistant,
    device_id: str,
    hours: int,
    force: bool,
) -> dict[str, Any]:
    cache = _history_domain_data(hass).setdefault(_DATA_HISTORY_CACHE, {})
    cache_key = f"{device_id}:{hours}"

    async with _history_lock(hass, cache_key):
        now_monotonic = time.monotonic()
        cached = cache.get(cache_key)
        if isinstance(cached, dict):
            age = now_monotonic - float(cached.get("loaded_at", 0))
            cache_limit = HISTORY_FORCE_REFRESH_SECONDS if force else HISTORY_CACHE_SECONDS
            if age < cache_limit:
                return {**cached["payload"], "cached": True}

        _consume_history_budget(hass)
        period_end = int(time.time())
        period_start = period_end - hours * 3600
        rows, descriptions = await asyncio.gather(
            _read_starline_event_rows(hass, device_id, period_start, period_end),
            _event_descriptions(hass),
        )
        payload = {
            "source": "starline_open_api",
            "time_semantics": "starline_event_time",
            "events": _normalize_starline_events(
                rows, descriptions, period_start, period_end
            ),
            "cached": False,
        }
        cache[cache_key] = {"loaded_at": time.monotonic(), "payload": payload}
        return payload


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/panel/bootstrap",
        vol.Optional("entry_id"): str,
        vol.Optional("force", default=False): bool,
    }
)
@websocket_api.async_response
async def websocket_panel_bootstrap(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    entry_id = msg.get("entry_id")
    entry = hass.config_entries.async_get_entry(entry_id) if entry_id else None
    connection.send_result(
        msg["id"], await _bootstrap_payload_live(hass, entry, msg["force"])
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/panel/history",
        vol.Required("device_id"): vol.All(vol.Coerce(str), vol.Match(r"^\d+$")),
        vol.Optional("hours", default=24): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=24)
        ),
        vol.Optional("force", default=False): bool,
    }
)
@websocket_api.async_response
async def websocket_panel_history(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    device_id = msg["device_id"]
    known_devices = {
        str(item["device_id"]) for item in _discover_vehicle_entities(hass)
    }
    if device_id not in known_devices:
        connection.send_error(msg["id"], "not_found", "StarLine vehicle was not found")
        return
    try:
        payload = await _starline_history(
            hass,
            device_id,
            msg["hours"],
            msg["force"],
        )
    except StarLineApiError as err:
        connection.send_error(msg["id"], "history_unavailable", str(err))
        return
    connection.send_result(msg["id"], payload)


async def async_register_native_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get(_DATA_WS_REGISTERED):
        websocket_api.async_register_command(hass, websocket_panel_bootstrap)
        websocket_api.async_register_command(hass, websocket_panel_history)
        domain_data[_DATA_WS_REGISTERED] = True
    if not domain_data.get(_DATA_STATIC_REGISTERED):
        frontend_dir = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths([StaticPathConfig(PANEL_STATIC_URL, str(frontend_dir), cache_headers=False)])
        domain_data[_DATA_STATIC_REGISTERED] = True
    if domain_data.get(_DATA_PANEL_REGISTERED):
        return
    if frontend.async_panel_exists(hass, PANEL_URL_PATH):
        _LOGGER.error("Cannot register StarLine panel: /%s is already used by another panel", PANEL_URL_PATH)
        return
    try:
        await panel_custom.async_register_panel(hass=hass, frontend_url_path=PANEL_URL_PATH, webcomponent_name=PANEL_COMPONENT, sidebar_title=PANEL_TITLE, sidebar_icon=PANEL_ICON, module_url=PANEL_MODULE, embed_iframe=False, require_admin=False, handle_safe_area=True, config={"entry_id": entry.entry_id, "panel_version": PANEL_VERSION, "parent_route": PANEL_PARENT_ROUTE, "preferred_view": PANEL_PREFERRED_VIEW, "bootstrap_fallback": _bootstrap_payload(hass, entry)})
    except ValueError as err:
        _LOGGER.error("Unable to register StarLine native panel: %s", err)
        return
    domain_data[_DATA_PANEL_ENTRY_ID] = entry.entry_id
    domain_data[_DATA_PANEL_REGISTERED] = True


@callback
def async_unregister_native_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    domain_data = hass.data.get(DOMAIN, {})
    if domain_data.get(_DATA_PANEL_ENTRY_ID) != entry.entry_id:
        return
    if domain_data.get(_DATA_PANEL_REGISTERED) and frontend.async_panel_exists(hass, PANEL_URL_PATH):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    domain_data[_DATA_PANEL_REGISTERED] = False
