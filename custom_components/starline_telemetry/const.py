"""Constants for StarLine Telemetry."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.const import Platform

DOMAIN = "starline_telemetry"

CONF_APP_ID = "app_id"
CONF_APP_SECRET = "app_secret"
CONF_USERNAME = "username"
CONF_PASSWORD_HASH = "password_hash"

PLATFORMS: tuple[Platform, ...] = (
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
    Platform.DEVICE_TRACKER,
)

MIN_SCAN_INTERVAL = timedelta(seconds=180)
DAILY_DEVICE_REQUEST_BUDGET = 800
SECONDS_PER_DAY = 86_400
REQUEST_TIMEOUT_SECONDS = 20

STARLINE_ID_BASE_URL = "https://id.starline.ru"
STARLINE_API_BASE_URL = "https://developer.starline.ru"
