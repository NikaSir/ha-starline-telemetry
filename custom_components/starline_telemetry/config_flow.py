"""Config flow for StarLine Telemetry."""

from __future__ import annotations

import hashlib
import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_PASSWORD
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import (
    StarLineApiClient,
    StarLineApiError,
    StarLineAuthenticationError,
    StarLineRequestError,
    StarLineTwoFactorRequired,
)
from .const import (
    CONF_APP_ID,
    CONF_APP_SECRET,
    CONF_MODE,
    CONF_PASSWORD_HASH,
    CONF_USERNAME,
    CORE_STARLINE_DOMAIN,
    DOMAIN,
    MODE_CORE_BRIDGE,
    MODE_TELEMETRY,
)

_LOGGER = logging.getLogger(__name__)


class StarLineNoDevicesError(Exception):
    """Authentication succeeded but the account returned no vehicles."""


async def _validate_input(hass: HomeAssistant, data: dict[str, Any]) -> str:
    """Validate StarLine credentials and confirm at least one vehicle exists."""
    password_hash = hashlib.sha1(
        str(data[CONF_PASSWORD]).encode(), usedforsecurity=False
    ).hexdigest()
    client = StarLineApiClient(
        async_get_clientsession(hass),
        str(data[CONF_APP_ID]).strip(),
        str(data[CONF_APP_SECRET]).strip(),
        str(data[CONF_USERNAME]).strip(),
        password_hash,
    )
    await client.async_authenticate()
    devices = await client.async_get_devices()
    if not devices:
        raise StarLineNoDevicesError
    return password_hash


class StarLineTelemetryConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for StarLine Telemetry."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Choose between the existing StarLine bridge and own telemetry."""
        options = ["telemetry"]
        if self.hass.config_entries.async_entries(CORE_STARLINE_DOMAIN):
            options.insert(0, "core_bridge")
        return self.async_show_menu(step_id="user", menu_options=options)

    async def async_step_core_bridge(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Create a panel-only entry backed by the existing core integration."""
        if not self.hass.config_entries.async_entries(CORE_STARLINE_DOMAIN):
            return self.async_abort(reason="core_starline_not_found")
        await self.async_set_unique_id("core_starline_bridge")
        self._abort_if_unique_id_configured()
        return self.async_create_entry(
            title="StarLine Panel",
            data={CONF_MODE: MODE_CORE_BRIDGE},
        )

    async def async_step_telemetry(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure the standalone read-only telemetry source."""
        errors: dict[str, str] = {}

        if user_input is not None:
            try:
                password_hash = await _validate_input(self.hass, user_input)
            except StarLineTwoFactorRequired:
                errors["base"] = "two_factor_not_supported"
            except StarLineAuthenticationError:
                errors["base"] = "invalid_auth"
            except StarLineNoDevicesError:
                errors["base"] = "no_devices"
            except StarLineRequestError as err:
                _LOGGER.warning(
                    "StarLine setup request failed at stage %s "
                    "(HTTP=%s, API=%s): %s",
                    err.stage,
                    err.http_status,
                    err.api_code,
                    err.detail,
                )
                errors["base"] = f"api_{err.stage}"
            except StarLineApiError as err:
                _LOGGER.warning("StarLine setup API error: %s", err)
                errors["base"] = "cannot_connect"
            else:
                username = str(user_input[CONF_USERNAME]).strip()
                await self.async_set_unique_id(username.casefold())
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=username,
                    data={
                        CONF_MODE: MODE_TELEMETRY,
                        CONF_APP_ID: str(user_input[CONF_APP_ID]).strip(),
                        CONF_APP_SECRET: str(user_input[CONF_APP_SECRET]).strip(),
                        CONF_USERNAME: username,
                        CONF_PASSWORD_HASH: password_hash,
                    },
                )

        return self.async_show_form(
            step_id="telemetry",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_APP_ID): str,
                    vol.Required(CONF_APP_SECRET): str,
                    vol.Required(CONF_USERNAME): str,
                    vol.Required(CONF_PASSWORD): str,
                }
            ),
            errors=errors,
        )
