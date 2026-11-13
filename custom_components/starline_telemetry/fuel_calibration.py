"""Persist fuel calibration samples from confirmed full refuels."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping, Sequence
from copy import deepcopy
from datetime import UTC, datetime, timedelta
import math
from statistics import median
from typing import TYPE_CHECKING, Literal, NotRequired, TypedDict
from zoneinfo import ZoneInfo

if TYPE_CHECKING:
    from homeassistant.core import State
    from homeassistant.helpers.storage import Store

FUEL_ROLES = ("fuel", "fuel_percent", "fuel_litres", "fuel_volume")
MAX_REPORT_AGE = timedelta(minutes=30)
REFUEL_FINISH_WINDOW = timedelta(minutes=30)
RECEIPT_BEFORE_WINDOW = timedelta(minutes=5)
RECEIPT_PREFERRED_WINDOW = timedelta(hours=1)
RECEIPT_AFTER_WINDOW = timedelta(hours=7)
RECEIPT_BASELINE_LOOKBACK = timedelta(days=1)
MOSCOW_TIME = ZoneInfo("Europe/Moscow")
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
    receipt_at: NotRequired[str]


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
    receipt_preview: NotRequired[RefuelSample]


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


def _capture_report(
    state: State | None, now: datetime, *, reported_at: datetime | None = None
) -> FuelReport:
    try:
        value = float(state.state) if state is not None else math.nan
    except (TypeError, ValueError):
        value = math.nan
    if not 0 <= value <= 100 or state is None:
        raise FuelCalibrationError("fuel_unavailable", "Fuel percentage is unavailable")
    if _percent_entity(state) is None:
        raise FuelCalibrationError("fuel_unit_unsupported", "Fuel source must report percent")
    reported_at = reported_at or state_reported_at(state)
    if not timedelta(0) <= now - reported_at <= MAX_REPORT_AGE:
        raise FuelCalibrationError("fuel_stale", "Wait for a fresh Home Assistant fuel report")
    return {
        "value": value,
        "unit": "%",
        "entity_id": state.entity_id,
        "reported_at": reported_at.astimezone(UTC).isoformat(),
    }


def _parse_receipt_at(value: str | None, now: datetime) -> datetime:
    try:
        local = datetime.strptime(value or "", "%Y-%m-%dT%H:%M")
        receipt_at = local.replace(tzinfo=MOSCOW_TIME).astimezone(UTC)
    except (ValueError, OverflowError) as err:
        raise FuelCalibrationError("invalid_receipt_at", "Enter the Moscow receipt time") from err
    if receipt_at > now:
        raise FuelCalibrationError("invalid_receipt_at", "Receipt time cannot be in the future")
    return receipt_at


def _receipt_reports(
    states: Sequence[State],
    entity_id: str,
    receipt_at: datetime,
    end: datetime,
    min_gain: float,
) -> tuple[FuelReport, FuelReport]:
    before: FuelReport | None = None
    best_pair: tuple[FuelReport, FuelReport] | None = None
    best_gain = min_gain
    window_start = receipt_at - RECEIPT_BEFORE_WINDOW
    preferred_end = receipt_at + RECEIPT_PREFERRED_WINDOW
    for state in sorted(states, key=lambda state: state.last_updated):
        if state.entity_id != entity_id:
            continue
        timestamp = state.last_updated
        if timestamp > preferred_end and best_pair is not None:
            return best_pair
        if not receipt_at - RECEIPT_BASELINE_LOOKBACK <= timestamp <= end:
            continue
        try:
            report = _capture_report(state, timestamp, reported_at=timestamp)
        except FuelCalibrationError:
            # Recorder may report an outage across the refuel. Keep the last
            # valid pre-refuel reading with its original timestamp.
            continue
        if timestamp <= window_start:
            before = report
            continue
        if before is None:
            if timestamp < receipt_at:
                before = report
            continue
        if state.last_changed != timestamp:
            continue
        gain = report["value"] - before["value"]
        if gain > best_gain:
            if timestamp > preferred_end:
                return before, report
            best_pair = before, report
            best_gain = gain
        if timestamp < receipt_at and gain <= 0:
            before = report
    if best_pair is not None:
        return best_pair
    raise FuelCalibrationError(
        "receipt_history_missing", "No matching fuel readings around the receipt time"
    )


def _volume(value: float | None, code: str, label: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not 0 < value <= MAX_VOLUME_L
    ):
        raise FuelCalibrationError(code, f"Enter a positive {label} in litres")
    return float(value)


def _refuel_amount(
    record: VehicleCalibration, litres: float | None, capacity_l: float | None
) -> tuple[float, float | None]:
    filled = _volume(litres, "invalid_litres", "refuel amount")
    capacity = record["capacity_l"]
    if capacity_l is not None:
        capacity = _volume(capacity_l, "invalid_capacity", "tank capacity")
    if capacity is not None and filled > capacity:
        raise FuelCalibrationError("invalid_litres", "Refuel amount exceeds tank capacity")
    return filled, capacity


def _same_refuel(first: RefuelSample, second: RefuelSample) -> bool:
    if first["after"]["entity_id"] != second["after"]["entity_id"]:
        return False
    if first["after"] == second["after"]:
        return True
    if first.get("receipt_at"):
        first, second = second, first
    if first.get("receipt_at") or not second.get("receipt_at"):
        return False
    receipt_at = datetime.fromisoformat(second["receipt_at"])
    first_after = datetime.fromisoformat(first["after"]["reported_at"])
    return (
        first["litres"] == second["litres"]
        and receipt_at - RECEIPT_BEFORE_WINDOW
        <= first_after <= receipt_at + RECEIPT_PREFERRED_WINDOW
    )


def _append_sample(record: VehicleCalibration, sample: RefuelSample) -> None:
    if any(_same_refuel(existing, sample) for existing in record["samples"]):
        raise FuelCalibrationError("receipt_already_saved", "This fuel reading is already recorded")
    record["samples"] = [*record["samples"], sample][-MAX_SAMPLES:]
    record["capacity_l"] = sample["capacity_l"]


def _minimum_receipt_gain(litres: float, capacity_l: float | None) -> float:
    if capacity_l is None:
        substantial_refuel = litres >= MIN_PLATEAU_LITRES
    else:
        substantial_refuel = 100 * litres / capacity_l > MAX_CHECK_ERROR
    return MAX_PLATEAU_CHANGE if substantial_refuel else 0.0


def _has_implausible_gain(sample: RefuelSample, capacity_l: float | None) -> bool:
    gain = sample["after"]["value"] - sample["before"]["value"]
    return gain < -MAX_PLATEAU_CHANGE or (
        _minimum_receipt_gain(sample["litres"], capacity_l) > 0
        and gain <= MAX_PLATEAU_CHANGE
    )


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


def _view(
    record: VehicleCalibration, state: State | None, fuel_entity_id: str | None = None
) -> CalibrationView:
    entity_id = _percent_entity(state)
    if entity_id is None and any(
        sample["after"]["entity_id"] == fuel_entity_id for sample in record["samples"]
    ):
        entity_id = fuel_entity_id
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

    async def async_view(
        self, device_id: str, state: State | None, fuel_entity_id: str | None = None
    ) -> CalibrationView:
        """Read the persisted pending refuel and active model for one vehicle."""
        async with self._lock:
            return _view(self._record(await self._load(), device_id), state, fuel_entity_id)

    async def async_apply(
        self,
        device_id: str,
        action: Literal["start", "mark_full", "finish", "cancel", "preview_receipt", "record_receipt"],
        read_state: Callable[[], State | None],
        *,
        started_at: str | None = None,
        litres: float | None = None,
        capacity_l: float | None = None,
        receipt_at: str | None = None,
        expected_after_at: str | None = None,
        fuel_entity_id: str | None = None,
        read_history: Callable[[str, datetime, datetime], Awaitable[Sequence[State]]] | None = None,
        now: datetime | None = None,
    ) -> CalibrationView:
        """Make one complete, guarded transition for a vehicle."""
        async with self._lock:
            records = await self._load()
            record = self._record(records, device_id).copy()
            state = read_state()
            now = now or datetime.now(UTC)
            pending = record["pending"]
            if action in ("preview_receipt", "record_receipt"):
                sample = await self._receipt_sample(
                    record, _percent_entity(state) or fuel_entity_id,
                    now, receipt_at, litres, capacity_l, read_history
                )
                _append_sample(record, sample)
                if action == "preview_receipt":
                    view = _view(self._record(records, device_id), state, fuel_entity_id)
                    view["receipt_preview"] = sample
                    return view
                if expected_after_at is not None and sample["after"]["reported_at"] != expected_after_at:
                    raise FuelCalibrationError("receipt_history_changed", "Fuel readings changed")
            elif action == "start":
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
            return _view(record, state, fuel_entity_id)

    @staticmethod
    async def _receipt_sample(
        record: VehicleCalibration,
        entity_id: str | None,
        now: datetime,
        receipt_at: str | None,
        litres: float | None,
        capacity_l: float | None,
        read_history: Callable[[str, datetime, datetime], Awaitable[Sequence[State]]] | None,
    ) -> RefuelSample:
        receipt_time = _parse_receipt_at(receipt_at, now)
        receipt_iso = receipt_time.isoformat()
        if any(sample.get("receipt_at") == receipt_iso for sample in record["samples"]):
            raise FuelCalibrationError("receipt_already_saved", "This receipt is already recorded")
        if entity_id is None or read_history is None:
            raise FuelCalibrationError("receipt_history_missing", "Fuel history is unavailable")
        filled, capacity = _refuel_amount(record, litres, capacity_l)
        end = min(now, receipt_time + RECEIPT_AFTER_WINDOW)
        history = await read_history(entity_id, receipt_time - RECEIPT_BASELINE_LOOKBACK, end)
        before, after = _receipt_reports(
            history, entity_id, receipt_time, end, _minimum_receipt_gain(filled, capacity)
        )
        return {
            "before": before,
            "after": after,
            "litres": filled,
            "capacity_l": capacity,
            "receipt_at": receipt_iso,
        }

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
        filled, capacity = _refuel_amount(record, litres, capacity_l)
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
        _append_sample(record, sample)
