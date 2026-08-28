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


class StarLineRequestError(StarLineApiError):
    """A request failed at a known StarLine API stage."""

    def __init__(
        self,
        stage: str,
        detail: str,
        *,
        http_status: int | None = None,
        api_code: int | None = None,
    ) -> None:
        super().__init__(detail)
        self.stage = stage
        self.detail = detail
        self.http_status = http_status
        self.api_code = api_code


async def _async_request_json(
    session: ClientSession,
    method: str,
    url: str,
    *,
    stage: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """Make one StarLine request and return a decoded JSON object."""
    try:
        async with session.request(method, url, timeout=_TIMEOUT, **kwargs) as response:
            http_status = response.status
            try:
                payload = await response.json(content_type=None)
            except (ValueError, TypeError) as err:
                raise StarLineRequestError(
                    stage,
                    f"Invalid JSON response ({type(err).__name__})",
                    http_status=http_status,
                ) from err
            if http_status >= 400:
                detail = (
                    str(payload.get("codestring") or payload.get("desc") or response.reason)
                    if isinstance(payload, dict)
                    else str(response.reason)
                )
                raise StarLineRequestError(
                    stage,
                    detail or "HTTP request failed",
                    http_status=http_status,
                )
    except StarLineRequestError:
        raise
    except (ClientError, TimeoutError) as err:
        raise StarLineRequestError(
            stage,
            f"{type(err).__name__}: {err}",
            http_status=getattr(err, "status", None),
        ) from err
    if not isinstance(payload, dict):
        raise StarLineRequestError(stage, "StarLine returned a non-object JSON response")
    return payload


def _api_code(payload: dict[str, Any]) -> int | None:
    """Return a StarLine response code as an integer when possible."""
    try:
        return int(payload.get("code"))
    except (TypeError, ValueError):
        return None


def _event_rows(payload: dict[str, Any], *, stage: str) -> list[dict[str, Any]]:
    """Validate and return StarLine event rows."""
    code = _api_code(payload)
    if code != 200:
        raise StarLineRequestError(
            stage,
            str(payload.get("codestring", "StarLine event request failed")),
            api_code=code,
        )
    events = payload.get("events")
    if not isinstance(events, list):
        raise StarLineRequestError(
            stage, "StarLine returned no event list", api_code=code
        )
    return [item for item in events if isinstance(item, dict)]


async def async_fetch_device_events(
    session: ClientSession,
    slnet_token: str,
    device_id: int | str,
    period_start: int,
    period_end: int,
) -> list[dict[str, Any]]:
    """Read the official StarLine event journal using an existing SLNet token."""
    stage = "device_events"
    payload = await _async_request_json(
        session,
        "POST",
        f"{STARLINE_API_BASE_URL}/json/v2/device/{device_id}/events",
        stage=stage,
        headers={"Cookie": f"slnet={slnet_token}"},
        json={"period_start": period_start, "period_end": period_end},
    )
    return _event_rows(payload, stage=stage)


async def async_fetch_device_data(
    session: ClientSession,
    slnet_token: str,
    device_id: int | str,
) -> dict[str, Any]:
    """Read one current device snapshot using an existing SLNet token."""
    stage = "device_data"
    payload = await _async_request_json(
        session,
        "GET",
        f"{STARLINE_API_BASE_URL}/json/v3/device/{device_id}/data",
        stage=stage,
        headers={"Cookie": f"slnet={slnet_token}"},
    )
    code = _api_code(payload)
    if code != 200:
        raise StarLineRequestError(
            stage,
            str(payload.get("codestring", "StarLine device-data request failed")),
            api_code=code,
        )
    data = payload.get("data")
    if not isinstance(data, dict):
        raise StarLineRequestError(
            stage, "StarLine returned no device data", api_code=code
        )
    return data


async def async_fetch_event_descriptions(
    session: ClientSession,
) -> dict[int, str]:
    """Read the public StarLine event-description library."""
    stage = "event_library"
    payload = await _async_request_json(
        session,
        "GET",
        f"{STARLINE_API_BASE_URL}/json/v3/library/events",
        stage=stage,
    )
    code = _api_code(payload)
    if code != 200:
        raise StarLineRequestError(
            stage,
            str(payload.get("codestring", "StarLine event library request failed")),
            api_code=code,
        )
    rows = payload.get("eventDescriptions")
    if not isinstance(rows, list):
        raise StarLineRequestError(
            stage, "StarLine returned no event descriptions", api_code=code
        )
    descriptions: dict[int, str] = {}
    for item in rows:
        if not isinstance(item, dict):
            continue
        try:
            event_id = int(item.get("code"))
        except (TypeError, ValueError):
            continue
        description = str(item.get("desc") or "").strip()
        if description:
            descriptions[event_id] = description
    if not descriptions:
        raise StarLineRequestError(stage, "StarLine event-description library is empty")
    return descriptions


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
            f"{STARLINE_ID_BASE_URL}/apiV3/application/getCode/",
            stage="app_code",
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
            f"{STARLINE_ID_BASE_URL}/apiV3/application/getToken/",
            stage="app_token",
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
            f"{STARLINE_ID_BASE_URL}/apiV3/user/login/",
            stage="user_login",
            params={"token": app_token},
            data={"login": self._username, "pass": self._password_hash},
        )
        state = self._state(login_payload)
        desc = login_payload.get("desc")
        if state != 1:
            if state == 2 or (
                isinstance(desc, dict)
                and ("phone" in desc or "captchaSid" in desc)
            ):
                raise StarLineTwoFactorRequired("StarLine confirmation is required")
            message = (
                str(desc.get("message", ""))
                if isinstance(desc, dict)
                else str(desc or "")
            )
            raise StarLineAuthenticationError(message or "StarLine login failed")

        if not isinstance(desc, dict):
            raise StarLineAuthenticationError("StarLine login response is invalid")

        user_token = desc.get("user_token")
        if not user_token:
            raise StarLineAuthenticationError("StarLine login response has no token")

        auth_payload, slnet_token = await self._request_json_with_cookie(
            "POST",
            f"{STARLINE_API_BASE_URL}/json/v2/auth.slid",
            stage="webapi_auth",
            json={"slid_token": user_token},
        )
        auth_user_id = auth_payload.get("user_id")
        auth_code = self._int_value(auth_payload.get("code"))
        if auth_code != 200:
            raise StarLineRequestError(
                "webapi_auth",
                str(auth_payload.get("codestring", "WebAPI authentication failed")),
                api_code=auth_code,
            )
        if not slnet_token or auth_user_id is None:
            raise StarLineAuthenticationError("WebAPI authentication returned no session")

        self._slnet_token = slnet_token
        self.user_id = int(auth_user_id)

    async def async_get_devices(self) -> list[StarLineDevice]:
        """Return owned and shared devices visible to the account."""
        if self.user_id is None:
            raise StarLineAuthenticationError("StarLine client is not authenticated")

        payload = await self._api_get(
            f"/json/v2/user/{self.user_id}/user_info",
            stage="user_info",
        )
        devices_raw: list[Any] = []
        for key in ("devices", "shared_devices"):
            value = payload.get(key)
            if isinstance(value, list):
                devices_raw.extend(value)

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
        payload = await self._api_get(
            f"/json/v3/device/{device_id}/data",
            stage="device_data",
        )
        data = payload.get("data")
        if not isinstance(data, dict):
            raise StarLineApiError(f"Device {device_id} returned no telemetry data")
        return data

    async def async_get_device_events(
        self,
        device_id: int,
        period_start: int,
        period_end: int,
    ) -> list[dict[str, Any]]:
        """Return the official read-only event journal for one device."""
        if not self._slnet_token:
            raise StarLineAuthenticationError("StarLine WebAPI session is missing")
        try:
            return await async_fetch_device_events(
                self._session,
                self._slnet_token,
                device_id,
                period_start,
                period_end,
            )
        except StarLineRequestError as err:
            if err.http_status in (401, 403) or err.api_code in (401, 403):
                self._slnet_token = None
                raise StarLineAuthenticationError("StarLine session expired") from err
            raise

    async def _api_get(
        self,
        path: str,
        *,
        stage: str,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not self._slnet_token:
            raise StarLineAuthenticationError("StarLine WebAPI session is missing")

        payload = await self._request_json(
            "GET",
            f"{STARLINE_API_BASE_URL}{path}",
            stage=stage,
            headers={"Cookie": f"slnet={self._slnet_token}"},
            params=params,
        )
        code = self._int_value(payload.get("code"))
        if code in (401, 403):
            self._slnet_token = None
            raise StarLineAuthenticationError(
                str(payload.get("codestring", "StarLine session expired"))
            )
        if code != 200:
            raise StarLineRequestError(
                stage,
                str(payload.get("codestring", f"StarLine API error {code}")),
                api_code=code,
            )
        return payload

    async def _request_json(
        self,
        method: str,
        url: str,
        *,
        stage: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return await _async_request_json(
            self._session,
            method,
            url,
            stage=stage,
            **kwargs,
        )

    async def _request_json_with_cookie(
        self,
        method: str,
        url: str,
        *,
        stage: str,
        **kwargs: Any,
    ) -> tuple[dict[str, Any], str | None]:
        try:
            async with self._session.request(
                method, url, timeout=_TIMEOUT, **kwargs
            ) as response:
                http_status = response.status
                try:
                    payload = await response.json(content_type=None)
                except (ValueError, TypeError) as err:
                    raise StarLineRequestError(
                        stage,
                        f"Invalid JSON response ({type(err).__name__})",
                        http_status=http_status,
                    ) from err
                if http_status >= 400:
                    detail = (
                        str(payload.get("codestring") or payload.get("desc") or response.reason)
                        if isinstance(payload, dict)
                        else str(response.reason)
                    )
                    raise StarLineRequestError(
                        stage,
                        detail or "HTTP request failed",
                        http_status=http_status,
                    )
                cookie = response.cookies.get("slnet")
                slnet_token = cookie.value if cookie else None
        except StarLineRequestError:
            raise
        except (ClientError, TimeoutError) as err:
            raise StarLineRequestError(
                stage,
                f"{type(err).__name__}: {err}",
                http_status=getattr(err, "status", None),
            ) from err
        if not isinstance(payload, dict):
            raise StarLineRequestError(stage, "StarLine returned a non-object JSON response")
        return payload, slnet_token

    @staticmethod
    def _int_value(value: Any) -> int | None:
        """Convert an API value to int when possible."""
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _state(cls, payload: dict[str, Any]) -> int:
        """Return StarLine ID response state as an integer."""
        value = cls._int_value(payload.get("state"))
        return value if value is not None else -1

    @classmethod
    def _slid_value(cls, payload: dict[str, Any], key: str) -> str:
        if cls._state(payload) != 1:
            desc = payload.get("desc")
            message = (
                str(desc.get("message", "SLID request failed"))
                if isinstance(desc, dict)
                else str(desc or "SLID request failed")
            )
            raise StarLineAuthenticationError(message)
        desc = payload.get("desc")
        value = desc.get(key) if isinstance(desc, dict) else None
        if not value:
            raise StarLineAuthenticationError(f"SLID response has no {key}")
        return str(value)
