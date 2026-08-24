"""Minimal read-only client for the official StarLine Open API."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from typing import Any

from aiohttp import ClientError, ClientSession, ClientTimeout

from .const import (
    REQUEST_TIMEOUT_SECONDS,
    STARLINE_API_BASE_URL,
    STARLINE_ID_BASE_URL,
)

_TIMEOUT = ClientTimeout(total=REQUEST_TIMEOUT_SECONDS)


class StarLineApiError(Exception):
    """Base StarLine API error."""


class StarLineAuthenticationError(StarLineApiError):
    """Authentication failed or expired."""


class StarLineTwoFactorRequired(StarLineAuthenticationError):
    """StarLine account requires interactive two-factor confirmation."""


@dataclass(slots=True, frozen=True)
class StarLineDevice:
    """A StarLine device discovered on the account."""

    device_id: int
    alias: str


class StarLineApiClient:
    """Read-only StarLine Open API client.

    The client intentionally implements only authentication, device discovery,
    and GET telemetry. It contains no vehicle-control or settings methods.
    """

    def __init__(
        self,
        session: ClientSession,
        app_id: str,
        app_secret: str,
        username: str,
        password_hash: str,
    ) -> None:
        self._session = session
        self._app_id = app_id
        self._app_secret = app_secret
        self._username = username
        self._password_hash = password_hash
        self._slnet_token: str | None = None
        self.user_id: int | None = None

    async def async_authenticate(self) -> None:
        """Authenticate with StarLine ID and WebAPI."""
        app_code_payload = await self._request_json(
            "GET",
            f"{STARLINE_ID_BASE_URL}/apiV3/application/getCode",
            params={
                "appId": self._app_id,
                "secret": hashlib.md5(
                    self._app_secret.encode(), usedforsecurity=False
                ).hexdigest(),
            },
        )
        app_code = self._slid_value(app_code_payload, "code")

        app_token_payload = await self._request_json(
            "GET",
            f"{STARLINE_ID_BASE_URL}/apiV3/application/getToken",
            params={
                "appId": self._app_id,
                "secret": hashlib.md5(
                    f"{self._app_secret}{app_code}".encode(), usedforsecurity=False
                ).hexdigest(),
            },
        )
        app_token = self._slid_value(app_token_payload, "token")

        login_payload = await self._request_json(
            "POST",
            f"{STARLINE_ID_BASE_URL}/apiV3/user/login",
            headers={"token": app_token},
            data={"login": self._username, "pass": self._password_hash},
        )
        if login_payload.get("state") != 1:
            desc = login_payload.get("desc")
            message = str(desc.get("message", "")) if isinstance(desc, dict) else str(desc or "")
            if "Need confirmation" in message:
                raise StarLineTwoFactorRequired(message)
            raise StarLineAuthenticationError(message or "StarLine login failed")

        desc = login_payload.get("desc")
        if not isinstance(desc, dict):
            raise StarLineAuthenticationError("StarLine login response is invalid")

        user_token = desc.get("user_token")
        user_id = desc.get("id")
        if not user_token or user_id is None:
            raise StarLineAuthenticationError("StarLine login response has no token")

        auth_payload, slnet_token = await self._request_json_with_cookie(
            "POST",
            f"{STARLINE_API_BASE_URL}/json/v2/auth.slid",
            json={"slid_token": user_token},
        )
        if auth_payload.get("code") != 200 or not slnet_token:
            raise StarLineAuthenticationError(
                str(auth_payload.get("codestring", "WebAPI authentication failed"))
            )

        self._slnet_token = slnet_token
        self.user_id = int(auth_payload.get("user_id", user_id))

    async def async_get_devices(self) -> list[StarLineDevice]:
        """Return devices visible to the authenticated account."""
        if self.user_id is None:
            raise StarLineAuthenticationError("StarLine client is not authenticated")

        payload = await self._api_get(
            f"/json/v1/user/{self.user_id}/deviceList",
            params={"imei": "true", "alias": "true", "pos": "true", "status": "true"},
        )
        data = payload.get("data")
        devices_raw = data.get("devices", []) if isinstance(data, dict) else []
        devices: list[StarLineDevice] = []
        for item in devices_raw:
            if not isinstance(item, dict) or item.get("device_id") is None:
                continue
            device_id = int(item["device_id"])
            alias = str(item.get("alias") or f"StarLine {device_id}")
            devices.append(StarLineDevice(device_id=device_id, alias=alias))
        return devices

    async def async_get_device_data(self, device_id: int) -> dict[str, Any]:
        """Return the full read-only telemetry snapshot for one device."""
        payload = await self._api_get(f"/json/v3/device/{device_id}/data")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise StarLineApiError(f"Device {device_id} returned no telemetry data")
        return data

    async def _api_get(
        self, path: str, *, params: dict[str, str] | None = None
    ) -> dict[str, Any]:
        if not self._slnet_token:
            raise StarLineAuthenticationError("StarLine WebAPI session is missing")

        payload = await self._request_json(
            "GET",
            f"{STARLINE_API_BASE_URL}{path}",
            headers={"Cookie": f"slnet={self._slnet_token}"},
            params=params,
        )
        code = payload.get("code")
        if code in (401, 403):
            self._slnet_token = None
            raise StarLineAuthenticationError(
                str(payload.get("codestring", "StarLine session expired"))
            )
        if code != 200:
            raise StarLineApiError(
                str(payload.get("codestring", f"StarLine API error {code}"))
            )
        return payload

    async def _request_json(
        self, method: str, url: str, **kwargs: Any
    ) -> dict[str, Any]:
        try:
            async with self._session.request(
                method, url, timeout=_TIMEOUT, **kwargs
            ) as response:
                response.raise_for_status()
                payload = await response.json(content_type=None)
        except (ClientError, TimeoutError, ValueError) as err:
            raise StarLineApiError(f"StarLine request failed: {err}") from err
        if not isinstance(payload, dict):
            raise StarLineApiError("StarLine returned an invalid JSON response")
        return payload

    async def _request_json_with_cookie(
        self, method: str, url: str, **kwargs: Any
    ) -> tuple[dict[str, Any], str | None]:
        try:
            async with self._session.request(
                method, url, timeout=_TIMEOUT, **kwargs
            ) as response:
                response.raise_for_status()
                payload = await response.json(content_type=None)
                cookie = response.cookies.get("slnet")
                slnet_token = cookie.value if cookie else None
        except (ClientError, TimeoutError, ValueError) as err:
            raise StarLineApiError(f"StarLine request failed: {err}") from err
        if not isinstance(payload, dict):
            raise StarLineApiError("StarLine returned an invalid JSON response")
        return payload, slnet_token

    @staticmethod
    def _slid_value(payload: dict[str, Any], key: str) -> str:
        if payload.get("state") != 1:
            desc = payload.get("desc")
            message = str(desc.get("message", "SLID request failed")) if isinstance(desc, dict) else str(desc or "SLID request failed")
            raise StarLineAuthenticationError(message)
        desc = payload.get("desc")
        value = desc.get(key) if isinstance(desc, dict) else None
        if not value:
            raise StarLineAuthenticationError(f"SLID response has no {key}")
        return str(value)
