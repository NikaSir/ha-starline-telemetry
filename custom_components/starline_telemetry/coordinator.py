"""Data update coordinator for StarLine Telemetry."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
import math
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import StarLineApiClient, StarLineApiError, StarLineAuthenticationError
from .const import (
    DAILY_DEVICE_REQUEST_BUDGET,
    DOMAIN,
    MIN_SCAN_INTERVAL,
    SECONDS_PER_DAY,
)

_LOGGER = logging.getLogger(__name__)


class StarLineTelemetryCoordinator(DataUpdateCoordinator[dict[int, dict[str, Any]]]):
    """Coordinate quota-aware StarLine telemetry updates."""

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        client: StarLineApiClient,
        device_ids: list[int],
    ) -> None:
        self.client = client
        self.device_ids = device_ids
        quota_interval = timedelta(
            seconds=math.ceil(
                SECONDS_PER_DAY * max(len(device_ids), 1) / DAILY_DEVICE_REQUEST_BUDGET
            )
        )
        update_interval = max(MIN_SCAN_INTERVAL, quota_interval)
        super().__init__(
            hass,
            logger=_LOGGER,
            config_entry=config_entry,
            name=DOMAIN,
            update_interval=update_interval,
        )

    async def _async_update_data(self) -> dict[int, dict[str, Any]]:
        try:
            return await self._async_fetch_all()
        except StarLineAuthenticationError:
            try:
                await self.client.async_authenticate()
                return await self._async_fetch_all()
            except StarLineAuthenticationError as err:
                raise ConfigEntryAuthFailed("StarLine authentication failed") from err
            except StarLineApiError as err:
                raise UpdateFailed(str(err)) from err
        except StarLineApiError as err:
            raise UpdateFailed(str(err)) from err

    async def _async_fetch_all(self) -> dict[int, dict[str, Any]]:
        snapshots = await asyncio.gather(
            *(self.client.async_get_device_data(device_id) for device_id in self.device_ids)
        )
        return dict(zip(self.device_ids, snapshots, strict=True))
