"""Config flow for StarLine Telemetry."""

from __future__ import annotations

import hashlib
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
    StarLineTwoFactorRequired,
)
from .const import (
    CONF_APP_ID,
    CONF_APP_SECRET,
    CONF_PASSWORD_HASH,
    CONF_USERNAME,
    DOMAIN,
)


async def _validate_input(hass: HomeAssistant, data: dict[str, Any]) -> str:
    password_hash = hashlib.sha1(
        str(data[CONF_PASSWORD]).encode(), usedforsecurity=False
    ).hexdigest()
    client = StarLineApiClient(
        async_get_clientsession(hass),
        str(data[CONF_APP_ID]),
        str(data[CONF_APP_SECRET]),
        str(data[CONF_USERNAME]),
        password_hash,
    )
    await client.async_authenticate()
    devices = await client.async_get_devices()
    if not devices:
        raise StarLineApiError("No StarLine devices found")
    return password_hash


class StarLineTelemetryConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for StarLine Telemetry."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial configuration step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            try:
                password_hash = await _validate_input(self.hass, user_input)
            except StarLineTwoFactorRequired:
                errors["base"] = "two_factor_not_supported"
            except StarLineAuthenticationError:
                errors["base"] = "invalid_auth"
            except StarLineApiError:
                errors["base"] = "cannot_connect"
            else:
                username = str(user_input[CONF_USERNAME]).strip()
                await self.async_set_unique_id(username.casefold())
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=username,
                    data={
                        CONF_APP_ID: str(user_input[CONF_APP_ID]).strip(),
                        CONF_APP_SECRET: str(user_input[CONF_APP_SECRET]),
                        CONF_USERNAME: username,
                        CONF_PASSWORD_HASH: password_hash,
                    },
                )

        return self.async_show_form(
            step_id="user",
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
