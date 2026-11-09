"""Persist fuel calibration samples from confirmed full refuels."""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from copy import deepcopy
from datetime import UTC, datetime, timedelta
import math
from statistics import median
from typing import TYPE_CHECKING, Literal, NotRequired, TypedDict

if TYPE_CHECKING:
    from homeassistant.core import State
    from homeassistant.helpers.storage import Store

FUEL_ROLES = ("fuel", "fuel_percent", "fuel_litres", "fuel_volume")
MAX_REPORT_AGE = timedelta(minutes=30)
REFUEL_FINISH_WINDOW = timedelta(minutes=30)
MAX_SAMPLES = 20
MIN_SAMPLES = 3
MAX_FULL_SPREAD = 5
MAX_CHECK_ERROR = 10
MAX_PLATEAU_CHANGE = 2
MIN_PLATEAU_LITRES = 10
MAX_VOLUME_L = 1000


class FuelCalibrationError(ValueError):
    """A validation error that the panel can act on."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class FuelReport(TypedDict):
    """A recorded percentage report from a Home Assistant entity."""

    value: float
    unit: Literal["%"]
    entity_id: str
    reported_at: str


class PendingRefuel(TypedDict):
    """A pending refuel, optionally marked full and awaiting a report."""

    started_at: str
    before: FuelReport
    full_at: NotRequired[str]
    litres: NotRequired[float]
    capacity_l: NotRequired[float | None]


class RefuelSample(TypedDict):
    """A pair of reports and the litres from a confirmed full refuel."""

    before: FuelReport
    after: FuelReport
    litres: float
    capacity_l: float | None


class VehicleCalibration(TypedDict):
    """The stored record keyed by the StarLine device ID."""

    pending: PendingRefuel | None
    samples: list[RefuelSample]
    capacity_l: float | None


class CalibrationView(VehicleCalibration):
    """The active fuel source's samples and derived calibration."""

    entity_id: str | None
    unit: Literal["%"] | None
    full_value: float | None
    factor: float | None
    status: Literal["collecting", "ready", "inconsistent"]


def select_fuel_state(
    entities: Mapping[str, str], get_state: Callable[[str], State | None]
) -> State | None:
    """Resolve the same entity as the panel's uncalibrated fuel metric."""
    for role in FUEL_ROLES:
        if (entity_id := entities.get(role)) and (state := get_state(entity_id)) is not None:
            return state
    return None


def state_reported_at(state: State) -> datetime:
    """Return the latest HA state report, with a fallback for older states."""
    return getattr(state, "last_reported", None) or state.last_updated


def _percent_entity(state: State | None) -> str | None:
    if state is not None and state.attributes.get("unit_of_measurement") == "%":
        return state.entity_id
    return None


def _capture_report(state: State | None, now: datetime) -> FuelReport:
    try:
        value = float(state.state) if state is not None else math.nan
    except (TypeError, ValueError):
        value = math.nan
    if not 0 <= value <= 100 or state is None:
        raise FuelCalibrationError("fuel_unavailable", "Fuel percentage is unavailable")
    if _percent_entity(state) is None:
        raise FuelCalibrationError("fuel_unit_unsupported", "Fuel source must report percent")
    reported_at = state_reported_at(state)
    if not timedelta(0) <= now - reported_at <= MAX_REPORT_AGE:
        raise FuelCalibrationError("fuel_stale", "Wait for a fresh Home Assistant fuel report")
    return {
        "value": value,
        "unit": "%",
        "entity_id": state.entity_id,
        "reported_at": reported_at.astimezone(UTC).isoformat(),
    }


def _volume(value: float | None, code: str, label: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not 0 < value <= MAX_VOLUME_L
    ):
        raise FuelCalibrationError(code, f"Enter a positive {label} in litres")
    return float(value)


def _has_implausible_gain(sample: RefuelSample, capacity_l: float | None) -> bool:
    gain = sample["after"]["value"] - sample["before"]["value"]
    if gain < -MAX_PLATEAU_CHANGE:
        return True
    if capacity_l is None:
        substantial_refuel = sample["litres"] >= MIN_PLATEAU_LITRES
    else:
        substantial_refuel = 100 * sample["litres"] / capacity_l > MAX_CHECK_ERROR
    return substantial_refuel and gain <= MAX_PLATEAU_CHANGE


def _baseline_is_consistent(
    samples: list[RefuelSample], full_values: list[float], factor: float, capacity_l: float | None
) -> bool:
    if max(full_values) - min(full_values) > MAX_FULL_SPREAD:
        return False
    if any(_has_implausible_gain(sample, capacity_l) for sample in samples):
        return False
    if capacity_l is None:
        return True
    failed_checks = sum(
        abs(
            min(100, sample["before"]["value"] * factor)
            - 100 * (1 - sample["litres"] / capacity_l)
        ) > MAX_CHECK_ERROR
        for sample in samples
    )
    return failed_checks < 2


def _view(record: VehicleCalibration, state: State | None) -> CalibrationView:
    entity_id = _percent_entity(state)
    samples = [sample for sample in record["samples"] if sample["after"]["entity_id"] == entity_id]
    capacity_l = record["capacity_l"]
    result: CalibrationView = {
        "pending": record["pending"],
        "samples": samples,
        "capacity_l": capacity_l,
        "entity_id": entity_id,
        "unit": "%" if entity_id else None,
        "full_value": None,
        "factor": None,
        "status": "collecting",
    }
    if len(samples) >= MIN_SAMPLES:
        full_values = [sample["after"]["value"] for sample in samples]
        full_value = median(full_values)
        factor = 100 / full_value if full_value > 0 else math.inf
        if math.isfinite(factor) and _baseline_is_consistent(
            samples, full_values, factor, capacity_l
        ):
            result.update(status="ready", full_value=full_value, factor=factor)
        else:
            result["status"] = "inconsistent"
    return deepcopy(result)


class FuelCalibration:
    """Serialize panel actions and publish them only after saving the Store."""

    def __init__(self, store: Store[dict[str, VehicleCalibration]]) -> None:
        self._store = store
        self._lock = asyncio.Lock()
        self._records: dict[str, VehicleCalibration] | None = None

    async def _load(self) -> dict[str, VehicleCalibration]:
        if self._records is None:
            self._records = await self._store.async_load() or {}
        return self._records

    @staticmethod
    def _record(records: dict[str, VehicleCalibration], device_id: str) -> VehicleCalibration:
        return records.get(device_id, {"pending": None, "samples": [], "capacity_l": None})

    async def async_view(self, device_id: str, state: State | None) -> CalibrationView:
        """Read the persisted pending refuel and active model for one vehicle."""
        async with self._lock:
            return _view(self._record(await self._load(), device_id), state)

    async def async_apply(
        self,
        device_id: str,
        action: Literal["start", "mark_full", "finish", "cancel"],
        read_state: Callable[[], State | None],
        *,
        started_at: str | None = None,
        litres: float | None = None,
        capacity_l: float | None = None,
        now: datetime | None = None,
    ) -> CalibrationView:
        """Make one complete, guarded transition for a vehicle."""
        async with self._lock:
            records = await self._load()
            record = self._record(records, device_id).copy()
            state = read_state()
            now = now or datetime.now(UTC)
            pending = record["pending"]
            if action == "start":
                if pending is not None:
                    raise FuelCalibrationError("refuel_in_progress", "A refuel is already pending")
                record["pending"] = {
                    "started_at": now.astimezone(UTC).isoformat(),
                    "before": _capture_report(state, now),
                }
            else:
                if pending is None or started_at != pending["started_at"]:
                    raise FuelCalibrationError("refuel_conflict", "The pending refuel has changed")
                if action == "mark_full":
                    record["pending"] = self._mark_full(record, pending, now, litres, capacity_l)
                else:
                    if action == "finish":
                        self._finish(record, pending, state, now)
                    record["pending"] = None

            updated = {**records, device_id: record}
            self._records = None
            await self._store.async_save(updated)
            # HA Store can log a failed disk write without raising an exception.
            if await self._load() != updated:
                raise OSError("Unable to verify the fuel calibration write")
            return _view(record, state)

    @staticmethod
    def _mark_full(
        record: VehicleCalibration,
        pending: PendingRefuel,
        now: datetime,
        litres: float | None,
        capacity_l: float | None,
    ) -> PendingRefuel:
        if "full_at" in pending:
            raise FuelCalibrationError("refuel_conflict", "The refuel is already marked full")
        filled = _volume(litres, "invalid_litres", "refuel amount")
        capacity = record["capacity_l"]
        if capacity_l is not None:
            capacity = _volume(capacity_l, "invalid_capacity", "tank capacity")
        if capacity is not None and filled > capacity:
            raise FuelCalibrationError("invalid_litres", "Refuel amount exceeds tank capacity")
        return {
            **pending,
            "full_at": now.astimezone(UTC).isoformat(),
            "litres": filled,
            "capacity_l": capacity,
        }

    @staticmethod
    def _finish(
        record: VehicleCalibration,
        pending: PendingRefuel,
        state: State | None,
        now: datetime,
    ) -> None:
        if "full_at" not in pending:
            raise FuelCalibrationError("refuel_not_marked", "Mark the tank full before saving")
        full_at = datetime.fromisoformat(pending["full_at"])
        if now - full_at > REFUEL_FINISH_WINDOW:
            raise FuelCalibrationError("refuel_expired", "The full-refuel checkpoint has expired")
        before = pending["before"]
        if state is not None and _percent_entity(state) != before["entity_id"]:
            raise FuelCalibrationError(
                "fuel_source_changed", "Fuel source changed during the refuel"
            )
        after = _capture_report(state, now)
        changed_at = getattr(state, "last_changed", None)
        reported_at = datetime.fromisoformat(after["reported_at"])
        # A regular StarLine poll can republish cached OBD fuel as a fresh HA report.
        if (
            changed_at is None
            or not full_at < changed_at <= reported_at
            or after["value"] <= before["value"]
        ):
            raise FuelCalibrationError(
                "fuel_report_pending", "Wait for a higher fuel reading after marking the tank full"
            )
        after["reported_at"] = changed_at.astimezone(UTC).isoformat()
        capacity = pending["capacity_l"]
        sample: RefuelSample = {
            "before": before,
            "after": after,
            "litres": pending["litres"],
            "capacity_l": capacity,
        }
        record["samples"] = [*record["samples"], sample][-MAX_SAMPLES:]
        record["capacity_l"] = capacity
