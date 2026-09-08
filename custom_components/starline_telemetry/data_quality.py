"""Normalize StarLine telemetry without inventing binary states."""

from __future__ import annotations

from typing import Any


_TRUE_VALUES = frozenset(
    {"1", "on", "true", "open", "opened", "locked", "armed", "running"}
)
_FALSE_VALUES = frozenset(
    {"0", "off", "false", "closed", "unlocked", "disarmed", "stopped"}
)


def normalize_binary_value(
    value: Any, *, legacy_disarmed: bool = False
) -> bool | None:
    """Return an explicit binary value without inventing a state for unknown data."""
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0 or (legacy_disarmed and value == 2):
            return False
        return None

    raw = str(value).strip().lower()
    if raw in _TRUE_VALUES:
        return True
    if raw in _FALSE_VALUES or (legacy_disarmed and raw == "2"):
        return False
    return None
