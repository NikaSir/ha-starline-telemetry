"""Tests for full-refuel calibration against Home Assistant state reports."""

from __future__ import annotations

import __future__
import ast
import asyncio
from copy import deepcopy
from datetime import UTC, datetime, timedelta
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest


ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "custom_components/starline_telemetry/fuel_calibration.py"
FUEL_ID = "sensor.murano_130_fuel"
SECOND_FUEL_ID = "sensor.murano_683_fuel"


class MemoryStore:
    """Isolate serialized writes and allow loading them in a new session."""

    def __init__(self) -> None:
        self.data = None
        self.fail_save = False
        self.drop_save = False

    async def async_load(self):
        return deepcopy(self.data)

    async def async_save(self, data) -> None:
        await asyncio.sleep(0)
        if self.fail_save:
            raise OSError("storage unavailable")
        if not self.drop_save:
            self.data = deepcopy(data)


class FuelCalibrationTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.assertTrue(MODULE.is_file(), "Fuel calibration service has not been added")
        spec = importlib.util.spec_from_file_location("starline_fuel_calibration", MODULE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.storage = MemoryStore()
        self.calibration = self.module.FuelCalibration(self.storage)
        self.now = datetime.now(UTC)
        self.state = None

    def _report(self, value, *, entity_id=FUEL_ID, unit="%", age=0, has_last_reported=True):
        self.state = SimpleNamespace(
            entity_id=entity_id,
            state=str(value),
            attributes={"unit_of_measurement": unit},
            last_reported=self.now - timedelta(minutes=age) if has_last_reported else None,
            last_updated=self.now - timedelta(minutes=age if not has_last_reported else 60),
            last_changed=self.now - timedelta(minutes=age),
        )

    async def _apply(self, action, *, device_id="130", **fields):
        return await self.calibration.async_apply(
            device_id, action, lambda: self.state, now=self.now, **fields
        )

    async def _view(self, device_id="130"):
        return await self.calibration.async_view(device_id, self.state)

    async def _sample(self, before, after, litres, *, capacity_l=None, device_id="130"):
        self.now += timedelta(minutes=15)
        entity_id = FUEL_ID if device_id == "130" else SECOND_FUEL_ID
        self._report(before, entity_id=entity_id)
        start = await self._apply("start", device_id=device_id)
        started_at = start["pending"]["started_at"]
        self.now += timedelta(minutes=3)
        await self._apply(
            "mark_full",
            device_id=device_id,
            started_at=started_at,
            litres=litres,
            capacity_l=capacity_l,
        )
        self.now += timedelta(minutes=2)
        self._report(after, entity_id=entity_id)
        return await self._apply("finish", device_id=device_id, started_at=started_at)

    async def test_record_receipt_hours_later_uses_the_nearby_history(self):
        self.now = datetime(2026, 11, 13, 23, 0, tzinfo=UTC)
        self._report(12)
        receipt = datetime(2026, 11, 13, 20, 49, tzinfo=UTC)

        def reading(value, offset, entity_id=FUEL_ID, changed_offset=None):
            updated_at = receipt + timedelta(minutes=offset)
            return SimpleNamespace(
                entity_id=entity_id, state=str(value), attributes={"unit_of_measurement": "%"},
                last_updated=updated_at,
                last_changed=receipt + timedelta(minutes=(
                    offset if changed_offset is None else changed_offset
                )),
            )

        async def history(entity_id, start, end):
            self.assertEqual(FUEL_ID, entity_id)
            self.assertEqual(datetime(2026, 11, 12, 20, 49, tzinfo=UTC), start)
            self.assertEqual(datetime(2026, 11, 13, 23, 0, tzinfo=UTC), end)
            return [
                reading(49, -130), reading(57, -80), reading(57, -6, changed_offset=-80),
                reading(99, 0, entity_id=SECOND_FUEL_ID), reading(58, -3),
                reading(89, 1), reading(83, 25),
            ]

        fields = {"receipt_at": "2026-11-13T23:49", "litres": 25.58, "read_history": history}
        preview = await self._apply("preview_receipt", **fields)
        self.assertEqual(89, preview["receipt_preview"]["after"]["value"])
        self.assertIsNone(self.storage.data)
        with self.assertRaises(self.module.FuelCalibrationError) as changed:
            await self._apply("record_receipt", expected_after_at="different", **fields)
        self.assertEqual("receipt_history_changed", changed.exception.code)
        self.assertIsNone(self.storage.data)
        saved = await self._apply(
            "record_receipt", expected_after_at="2026-11-13T20:50:00+00:00", **fields
        )
        self.assertEqual(1, len(saved["samples"]))
        sample = saved["samples"][0]
        self.assertEqual((57, 89), (sample["before"]["value"], sample["after"]["value"]))
        self.assertEqual(25.58, sample["litres"])
        self.assertEqual("2026-11-13T20:49:00+00:00", sample["receipt_at"])
        self.assertEqual([], (await self._view("683"))["samples"])
        with self.assertRaises(self.module.FuelCalibrationError) as duplicate:
            await self._apply("record_receipt", **fields)
        self.assertEqual("receipt_already_saved", duplicate.exception.code)
        self.assertEqual(saved, await self._view())

    async def test_receipt_search_finds_the_delayed_murano_683_reading(self):
        self.now = datetime(2026, 11, 12, 17, 0, tzinfo=UTC)
        self._report(57, entity_id=SECOND_FUEL_ID)
        before_at = datetime(2026, 11, 12, 0, 3, 39, tzinfo=UTC)
        after_at = datetime(2026, 11, 12, 15, 33, 40, tzinfo=UTC)
        readings = []
        for value, timestamp in ((24, before_at), (57, after_at)):
            readings.append(SimpleNamespace(
                entity_id=SECOND_FUEL_ID, state=str(value),
                attributes={"unit_of_measurement": "%"},
                last_updated=timestamp, last_changed=timestamp,
            ))

        async def history(entity_id, start, end):
            self.assertEqual(SECOND_FUEL_ID, entity_id)
            return [state for state in readings if start <= state.last_updated <= end]

        fields = {
            "receipt_at": "2026-11-12T17:54", "litres": 25.55, "read_history": history,
        }
        preview = await self._apply("preview_receipt", device_id="683", **fields)
        pair = preview["receipt_preview"]
        self.assertEqual((24, 57), (pair["before"]["value"], pair["after"]["value"]))
        self.assertEqual("2026-11-12T15:33:40+00:00", pair["after"]["reported_at"])
        saved = await self._apply(
            "record_receipt", device_id="683",
            expected_after_at=pair["after"]["reported_at"], **fields,
        )
        self.assertEqual(1, len(saved["samples"]))

    async def test_receipt_search_prioritizes_the_first_hour_and_handles_delayed_recovery(self):
        self.now = datetime(2026, 11, 13, 22, 0, tzinfo=UTC)
        receipt = datetime(2026, 11, 13, 14, 0, tzinfo=UTC)
        self._report(57, entity_id=SECOND_FUEL_ID)
        cases = (
            ([(45, 57), (240, 90)], 57),
            ([(20, 25), (40, "unavailable"), (240, 57), (350, 90)], 57),
            ([(-2, "unavailable"), (240, 57)], 57),
            ([(40, "unavailable"), (420, 57)], 57),
            ([(40, "unavailable"), (421, 57)], None),
        )
        for changes, expected in cases:
            with self.subTest(changes=changes):
                readings = []
                for minute, value in [(-10, 24), *changes]:
                    at = receipt + timedelta(minutes=minute)
                    readings.append(SimpleNamespace(
                        entity_id=SECOND_FUEL_ID, state=str(value),
                        attributes={"unit_of_measurement": "%"},
                        last_updated=at, last_changed=at,
                    ))

                async def history(entity_id, start, end):
                    self.assertEqual(SECOND_FUEL_ID, entity_id)
                    return [state for state in readings if start <= state.last_updated <= end]

                fields = {
                    "device_id": "683", "receipt_at": "2026-11-13T17:00",
                    "litres": 25.55, "read_history": history,
                }
                if expected is None:
                    with self.assertRaises(self.module.FuelCalibrationError) as caught:
                        await self._apply("preview_receipt", **fields)
                    self.assertEqual("receipt_history_missing", caught.exception.code)
                else:
                    preview = await self._apply("preview_receipt", **fields)
                    pair = preview["receipt_preview"]
                    self.assertEqual((24, expected), (pair["before"]["value"], pair["after"]["value"]))
                self.assertIsNone(self.storage.data)
                if changes == [(40, "unavailable"), (420, 57)]:
                    self.assertEqual("2026-11-13T21:00:00+00:00", pair["after"]["reported_at"])
                    saved = await self._apply(
                        "record_receipt", expected_after_at=pair["after"]["reported_at"], **fields
                    )
                    self.assertEqual([pair], saved["samples"])
                    self.storage = MemoryStore()
                    self.calibration = self.module.FuelCalibration(self.storage)

    async def test_receipt_accepts_an_increase_just_before_the_receipt_without_live_data(self):
        self.now = datetime(2026, 11, 13, 23, 0, tzinfo=UTC)

        def reading(value, minute):
            timestamp = datetime(2026, 11, 13, 20, minute, tzinfo=UTC)
            return SimpleNamespace(
                entity_id=FUEL_ID, state=str(value), attributes={"unit_of_measurement": "%"},
                last_updated=timestamp, last_changed=timestamp,
            )

        async def history(*_):
            return [reading(57, 35), reading(89, 46), reading(88, 53)]

        saved = await self._apply(
            "record_receipt", receipt_at="2026-11-13T23:49", litres=25.58,
            read_history=history, fuel_entity_id=FUEL_ID,
        )
        sample = saved["samples"][0]
        self.assertEqual((57, 89), (sample["before"]["value"], sample["after"]["value"]))
        self.assertEqual("2026-11-13T20:46:00+00:00", sample["after"]["reported_at"])

    async def test_receipt_does_not_count_a_stepped_refill_already_captured_live(self):
        self.now = datetime(2026, 11, 13, 20, 44, tzinfo=UTC)
        self._report(57, has_last_reported=False)
        before = self.state
        started_at = (await self._apply("start"))["pending"]["started_at"]
        self.now += timedelta(minutes=5)
        await self._apply("mark_full", started_at=started_at, litres=25.58)
        self.now += timedelta(minutes=1)
        self._report(81, has_last_reported=False)
        intermediate = self.state
        await self._apply("finish", started_at=started_at)
        self.now += timedelta(minutes=3)
        self._report(89, has_last_reported=False)
        after = self.state

        async def history(*_):
            return [before, intermediate, after]

        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply(
                "record_receipt", receipt_at="2026-11-13T23:49",
                litres=25.58, read_history=history,
            )
        self.assertEqual("receipt_already_saved", caught.exception.code)
        self.assertEqual(1, len((await self._view())["samples"]))

    async def test_receipt_without_an_increase_after_a_short_outage_is_not_saved(self):
        self.now = datetime(2026, 10, 31, 13, 0, tzinfo=UTC)
        self._report(24, entity_id=SECOND_FUEL_ID)
        readings = []
        for state, hour, minute, second in (
            ("24", 8, 4, 33), ("unavailable", 8, 17, 3),
            ("24", 8, 28, 51), ("24", 8, 40, 34),
        ):
            timestamp = datetime(2026, 10, 31, hour, minute, second, tzinfo=UTC)
            readings.append(SimpleNamespace(
                entity_id=SECOND_FUEL_ID, state=state,
                attributes={"unit_of_measurement": "%"},
                last_updated=timestamp, last_changed=timestamp,
            ))

        async def history(entity_id, start, end):
            return [state for state in readings if start <= state.last_updated <= end]

        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply(
                "record_receipt", device_id="683", receipt_at="2026-10-31T11:20",
                litres=24.07, read_history=history,
            )
        self.assertEqual("receipt_history_missing", caught.exception.code)
        self.assertIsNone(self.storage.data)

    async def test_receipt_without_a_recorded_increase_is_not_a_calibration_sample(self):
        self.now = datetime(2026, 11, 13, 23, 0, tzinfo=UTC)
        self._report(95)

        async def history(*_):
            return []

        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply(
                "record_receipt", receipt_at="2026-11-13T23:49",
                litres=25.58, read_history=history,
            )
        self.assertEqual("receipt_history_missing", caught.exception.code)
        self.assertIsNone(self.storage.data)

    async def test_receipt_rejects_future_or_invalid_moscow_time_before_querying_history(self):
        self.now = datetime(2026, 11, 13, 20, 0, tzinfo=UTC)
        self._report(57)
        for receipt in ("2026-11-13T23:49", "2026-02-31T10:00", "2026-11-13T20:00+00:00"):
            with self.subTest(receipt=receipt):
                with self.assertRaises(self.module.FuelCalibrationError) as caught:
                    await self._apply("record_receipt", receipt_at=receipt, litres=25.58)
                self.assertEqual("invalid_receipt_at", caught.exception.code)

    async def test_pending_and_history_are_shared_and_isolated_by_vehicle(self) -> None:
        self._report(40)
        first = await self._apply("start")
        self.calibration = self.module.FuelCalibration(self.storage)
        self.assertEqual(first, await self._view())
        self._report(60, entity_id=SECOND_FUEL_ID)
        self.assertIsNone((await self._view("683"))["pending"])
        self.assertEqual([], (await self._view("683"))["samples"])

        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        self._report(40)
        marked = await self._apply("mark_full", started_at=started_at, litres=40, capacity_l=80)
        self.assertEqual(self.now.isoformat(), marked["pending"]["full_at"])
        self.assertIsNone(marked["capacity_l"])
        self.calibration = self.module.FuelCalibration(self.storage)
        self.assertEqual(marked, await self._view())
        self.now += timedelta(minutes=1)
        self._report(90)
        saved = await self._apply("finish", started_at=started_at)
        self.assertEqual(40, saved["samples"][0]["before"]["value"])
        self.assertEqual(90, saved["samples"][0]["after"]["value"])
        self.assertEqual(40, saved["samples"][0]["litres"])
        self.assertEqual(80, saved["capacity_l"])
        self.calibration = self.module.FuelCalibration(self.storage)
        self.assertEqual(saved, await self._view())

    async def test_finish_rejects_report_from_during_refuel(self) -> None:
        self._report(50, age=3)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        self._report(67)
        self.now += timedelta(minutes=1)
        marked = await self._apply("mark_full", started_at=started_at, litres=20)
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("fuel_report_pending", caught.exception.code)
        self.assertEqual(marked, await self._view())
        self._report(90)
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("fuel_report_pending", caught.exception.code)

    async def test_persisted_pre_fill_requires_marking_before_finish(self) -> None:
        self._report(50)
        first = await self._apply("start")
        self.calibration = self.module.FuelCalibration(self.storage)
        self.assertNotIn("full_at", first["pending"])
        self.now += timedelta(minutes=1)
        self._report(90)
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=first["pending"]["started_at"])
        self.assertEqual("refuel_not_marked", caught.exception.code)
        self.assertEqual(first, await self._view())

    async def test_finish_rejects_fuel_value_from_before_checkpoint_republished_after(self):
        self._report(50)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        earlier_change = self.now
        self.now += timedelta(minutes=1)
        await self._apply("mark_full", started_at=started_at, litres=30)
        self.now += timedelta(minutes=1)
        self._report(78)
        self.state.last_changed = earlier_change
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("fuel_report_pending", caught.exception.code)
        self.assertEqual([], (await self._view())["samples"])

    async def test_finish_requires_an_actual_change_timestamp(self) -> None:
        self._report(50)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        await self._apply("mark_full", started_at=started_at, litres=30)
        self.now += timedelta(minutes=1)
        self._report(78)
        del self.state.last_changed
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("fuel_report_pending", caught.exception.code)

    async def test_unchanged_readings_after_small_receipts_do_not_create_baseline(self) -> None:
        for _ in range(3):
            self._report(65)
            first = await self._apply("start")
            started_at = first["pending"]["started_at"]
            self.now += timedelta(minutes=1)
            await self._apply("mark_full", started_at=started_at, litres=5)
            self.now += timedelta(minutes=1)
            self._report(65.0)
            with self.assertRaises(self.module.FuelCalibrationError) as caught:
                await self._apply("finish", started_at=started_at)
            self.assertEqual("fuel_report_pending", caught.exception.code)
            view = await self._apply("cancel", started_at=started_at)
        self.assertEqual([], view["samples"])
        self.assertIsNone(view["factor"])

    async def test_finish_records_value_change_time_instead_of_republish_time(self) -> None:
        self._report(50)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        await self._apply("mark_full", started_at=started_at, litres=30)
        self.now += timedelta(minutes=1)
        changed_at = self.now
        self.now += timedelta(minutes=1)
        self._report(90)
        self.state.last_changed = changed_at
        saved = await self._apply("finish", started_at=started_at)
        self.assertEqual(changed_at.isoformat(), saved["samples"][0]["after"]["reported_at"])

    async def test_checkpoint_expires_and_remains_cancellable(self) -> None:
        self._report(50)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=2)
        marked = await self._apply("mark_full", started_at=started_at, litres=40)
        self.now += timedelta(minutes=31)
        self._report(90)
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("refuel_expired", caught.exception.code)
        self.assertEqual(marked, await self._view())
        self.assertIsNone((await self._apply("cancel", started_at=started_at))["pending"])

    async def test_duplicate_checkpoint_cannot_replace_receipt_or_restart_clock(self) -> None:
        self._report(50)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=2)
        self.state = None
        marked = await self._apply("mark_full", started_at=started_at, litres=40)
        self.assertEqual(self.now.isoformat(), marked["pending"]["full_at"])
        self.assertEqual(40, marked["pending"]["litres"])
        self.now += timedelta(minutes=1)
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("mark_full", started_at=started_at, litres=20)
        self.assertEqual("refuel_conflict", caught.exception.code)
        self.assertEqual(marked, await self._view())

    async def test_rejects_invalid_fuel_reports_and_falls_back_to_updated_time(self) -> None:
        for value, unit, age, code in (
            ("nan", "%", 0, "fuel_unavailable"),
            ("unavailable", "%", 0, "fuel_unavailable"),
            (101, "%", 0, "fuel_unavailable"),
            (-1, "%", 0, "fuel_unavailable"),
            (45, "L", 0, "fuel_unit_unsupported"),
            (45, "%", 31, "fuel_stale"),
            (45, "%", -1, "fuel_stale"),
        ):
            with self.subTest(value=value, unit=unit, age=age):
                self._report(value, unit=unit, age=age)
                with self.assertRaises(self.module.FuelCalibrationError) as caught:
                    await self._apply("start")
                self.assertEqual(code, caught.exception.code)
        self._report(0, has_last_reported=False)
        self.assertEqual(0, (await self._apply("start"))["pending"]["before"]["value"])

    async def test_source_change_excludes_old_samples_and_preserves_pending_for_cancellation(self):
        for full in (88, 90, 91):
            await self._sample(45, full, 40)
        self._report(35)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        marked = await self._apply("mark_full", started_at=started_at, litres=40)
        self.now += timedelta(minutes=5)
        self._report(88, entity_id="sensor.replacement_fuel")
        view = await self._view()
        self.assertEqual("collecting", view["status"])
        self.assertEqual([], view["samples"])
        self.assertEqual(marked["pending"], view["pending"])
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("fuel_source_changed", caught.exception.code)
        self.assertIsNone((await self._apply("cancel", started_at=started_at))["pending"])

    async def test_three_reproducible_full_reports_use_the_median(self) -> None:
        self.assertEqual("collecting", (await self._sample(45, 88, 40))["status"])
        self.assertEqual("collecting", (await self._sample(45, 91, 40))["status"])
        view = await self._sample(45, 90, 40)
        self.assertEqual("ready", view["status"])
        self.assertEqual(90, view["full_value"])
        self.assertAlmostEqual(100 / 90, view["factor"])

    async def test_wide_spread_suppresses_estimate(self) -> None:
        for full in (88, 91, 95):
            view = await self._sample(45, full, 40)
        self.assertEqual("inconsistent", view["status"])
        self.assertIsNone(view["factor"])

    async def test_two_refuel_checks_outside_tolerance_suppress_estimate(self) -> None:
        await self._sample(45, 90, 40, capacity_l=80)
        await self._sample(45, 90, 10)
        view = await self._sample(45, 90, 10)
        self.assertEqual(80, view["capacity_l"])
        self.assertEqual("inconsistent", view["status"])
        self.assertIsNone(view["factor"])

    async def test_small_increase_can_expose_a_plateau(self) -> None:
        for full in (89, 90, 91):
            await self._sample(45, full, 40)
        view = await self._sample(89, 90, 15)
        self.assertEqual("inconsistent", view["status"])
        self.assertIsNone(view["factor"])

    async def test_invalid_receipt_fields_leave_pending_untouched(self) -> None:
        self._report(50)
        first = await self._apply("start")
        self.now += timedelta(minutes=5)
        self._report(90)
        for litres, capacity_l, code in (
            (0, 80, "invalid_litres"),
            (True, 80, "invalid_litres"),
            (10, float("inf"), "invalid_capacity"),
            (81, 80, "invalid_litres"),
        ):
            with self.subTest(litres=litres, capacity_l=capacity_l):
                with self.assertRaises(self.module.FuelCalibrationError) as caught:
                    await self._apply(
                        "mark_full",
                        started_at=first["pending"]["started_at"],
                        litres=litres,
                        capacity_l=capacity_l,
                    )
                self.assertEqual(code, caught.exception.code)
        self.assertEqual(first, await self._view())

    async def test_concurrent_finish_saves_only_one_sample(self) -> None:
        self._report(50)
        starts = await asyncio.gather(
            self._apply("start"), self._apply("start"), return_exceptions=True
        )
        self.assertEqual("refuel_in_progress", starts[1].code)
        started_at = starts[0]["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        await self._apply("mark_full", started_at=started_at, litres=40)
        self.now += timedelta(minutes=5)
        self._report(90)
        finishes = await asyncio.gather(
            self._apply("finish", started_at=started_at),
            self._apply("finish", started_at=started_at),
            return_exceptions=True,
        )
        self.assertEqual("refuel_conflict", finishes[1].code)
        self.assertEqual(1, len((await self._view())["samples"]))

    async def test_stale_cancel_does_not_remove_a_new_refuel(self) -> None:
        self._report(50)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        await self._apply("cancel", started_at=started_at)
        self.now += timedelta(minutes=1)
        second = await self._apply("start")
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("cancel", started_at=started_at)
        self.assertEqual("refuel_conflict", caught.exception.code)
        self.assertEqual(second, await self._view())

    async def test_failed_write_does_not_change_the_visible_state(self) -> None:
        self._report(50)
        self.storage.fail_save = True
        with self.assertRaises(OSError):
            await self._apply("start")
        self.assertIsNone((await self._view())["pending"])
        self.storage.fail_save = False
        self.assertIsNotNone((await self._apply("start"))["pending"])

    async def test_history_is_bounded_per_vehicle(self) -> None:
        for _ in range(self.module.MAX_SAMPLES + 1):
            await self._sample(45, 90, 40)
        self.assertEqual(self.module.MAX_SAMPLES, len((await self._view())["samples"]))

    async def test_state_resolution_matches_the_raw_fuel_metric(self) -> None:
        self._report(60)
        core = self.state
        self._report(50, entity_id=SECOND_FUEL_ID)
        telemetry = self.state
        entities = {"fuel": FUEL_ID, "fuel_percent": SECOND_FUEL_ID}
        states = {FUEL_ID: core, SECOND_FUEL_ID: telemetry}
        self.assertIs(core, self.module.select_fuel_state(entities, states.get))
        del states[FUEL_ID]
        self.assertIs(telemetry, self.module.select_fuel_state(entities, states.get))
        self.assertIs(
            telemetry,
            self.module.select_fuel_state({"fuel_volume": SECOND_FUEL_ID}, states.get),
        )

    async def test_litres_source_does_not_reuse_percent_baseline(self) -> None:
        for full in (88, 90, 91):
            await self._sample(45, full, 40)
        self._report(60, unit="L")
        view = await self._view()
        self.assertEqual([], view["samples"])
        self.assertIsNone(view["factor"])
        self.assertIsNone(view["unit"])


    async def test_store_silently_dropping_a_write_leaves_no_pending_refuel(self) -> None:
        self._report(50)
        self.storage.drop_save = True
        with self.assertRaises(OSError):
            await self._apply("start")
        self.assertIsNone((await self._view())["pending"])

    async def test_nonfinite_factor_is_not_exposed(self) -> None:
        for _ in range(3):
            view = await self._sample(0, 5e-324, 1)
        self.assertEqual("inconsistent", view["status"])
        self.assertIsNone(view["factor"])

    async def test_finish_waits_when_fuel_decreases_after_checkpoint(self) -> None:
        self._report(75)
        first = await self._apply("start")
        started_at = first["pending"]["started_at"]
        self.now += timedelta(minutes=1)
        await self._apply("mark_full", started_at=started_at, litres=5)
        self.now += timedelta(minutes=1)
        self._report(60)
        with self.assertRaises(self.module.FuelCalibrationError) as caught:
            await self._apply("finish", started_at=started_at)
        self.assertEqual("fuel_report_pending", caught.exception.code)
        self.assertEqual([], (await self._view())["samples"])


class FuelCalibrationPanelTest(unittest.IsolatedAsyncioTestCase):
    def _handler(self, name, **dependencies):
        # The repository suite runs without HA installed. Exercise the actual
        # handler bodies with only their HA boundaries supplied by the tests.
        tree = ast.parse((MODULE.parent / "panel.py").read_text())
        functions = {
            node.name: node
            for node in tree.body
            if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef))
        }
        self.assertIn(name, functions)
        function = functions[name]
        function.decorator_list.clear()
        namespace = dict(dependencies)
        code = compile(
            ast.Module(body=[function], type_ignores=[]),
            "panel.py",
            "exec",
            flags=__future__.annotations.compiler_flag,
        )
        exec(code, namespace)
        return namespace[name]

    async def test_manual_core_refresh_is_shared_and_rate_limited(self) -> None:
        calls = []
        storage = {}
        lock = asyncio.Lock()
        now = 100.0

        async def call(*args, **kwargs):
            await asyncio.sleep(0)
            calls.append((args, kwargs))

        refresh = self._handler(
            "_refresh_core_starline",
            CORE_STARLINE_DOMAIN="starline",
            _DATA_CORE_REFRESH="core_refresh",
            _CORE_REFRESH_SECONDS=60,
            _history_domain_data=lambda _: storage,
            _history_lock=lambda *_: lock,
            _LOGGER=SimpleNamespace(warning=lambda *_: None),
            Context=SimpleNamespace,
            time=SimpleNamespace(monotonic=lambda: now),
        )
        hass = SimpleNamespace(
            services=SimpleNamespace(
                has_service=lambda *_: True,
                async_call=call,
            )
        )
        user = SimpleNamespace(id="admin")
        refreshed = await asyncio.gather(refresh(hass, user), refresh(hass, user))
        self.assertEqual([True, True], refreshed)
        self.assertEqual(
            [(("starline", "update_state"), {
                "blocking": True, "context": SimpleNamespace(user_id="admin"),
            })],
            calls,
        )
        now += 61
        self.assertTrue(await refresh(hass, user))
        self.assertEqual(2, len(calls))

        async def failed_call(*args, **kwargs):
            await call(*args, **kwargs)
            raise TimeoutError

        now += 61
        hass.services.async_call = failed_call
        self.assertFalse(await refresh(hass, user))
        self.assertFalse(await refresh(hass, user))
        self.assertEqual(3, len(calls))

        now += 61
        hass.services.has_service = lambda *_: False
        self.assertFalse(await refresh(hass, user))
        self.assertEqual(3, len(calls))

    async def test_manual_refresh_only_runs_for_forced_admin_bootstrap(self) -> None:
        calls = []
        security = []
        vehicles = [
            {"device_id": "130", "sources": {"fuel": "core_starline"}},
            {"device_id": "683", "sources": {"fuel": "core_starline"}},
        ]

        async def refresh(_, user):
            calls.append(user.id)
            return True

        async def live(_, device_id, force, *, core_refreshed=False):
            security.append((device_id, force, core_refreshed))
            return {}

        async def attach(*_):
            pass

        bootstrap = self._handler(
            "_bootstrap_payload_live",
            asyncio=asyncio,
            _bootstrap_payload=lambda *_: {"vehicles": deepcopy(vehicles), "panel": {}},
            _refresh_core_starline=refresh,
            _live_security_state=live,
            _async_attach_fuel_calibration=attach,
            _report_times=lambda *_: {},
        )
        admin = SimpleNamespace(is_admin=True, id="admin")
        guest = SimpleNamespace(is_admin=False, id="guest")
        await bootstrap(None, None, False, admin)
        await bootstrap(None, None, True, guest)
        await bootstrap(None, None, True, admin)
        self.assertEqual(["admin"], calls)
        self.assertEqual(
            [
                ("130", False, False), ("683", False, False),
                ("130", True, False), ("683", True, False),
                ("130", True, True), ("683", True, True),
            ],
            security,
        )

    async def test_security_uses_legacy_core_account_and_skips_duplicate_refresh(self) -> None:
        calls = []
        storage = {}

        async def update():
            calls.append("update")

        account = SimpleNamespace(
            api=SimpleNamespace(
                devices={130: SimpleNamespace(device_id=130, car_state={"arm": True})},
            ),
            update=update,
        )
        hass = SimpleNamespace(
            data={"starline": {"core-entry": account}},
            config_entries=SimpleNamespace(
                async_entries=lambda _: [SimpleNamespace(entry_id="core-entry", runtime_data=None)]
            ),
        )
        core_device = self._handler("_core_runtime_device", CORE_STARLINE_DOMAIN="starline")
        live = self._handler(
            "_live_security_state",
            _history_domain_data=lambda _: storage,
            _DATA_LIVE_SECURITY_CACHE="security_cache",
            _history_lock=lambda *_: asyncio.Lock(),
            _telemetry_client_for_device=lambda *_: None,
            _core_runtime_device=core_device,
            _core_token_for_device=lambda *_: None,
            _normalize_arm=bool,
            datetime=datetime,
            UTC=UTC,
            time=SimpleNamespace(monotonic=lambda: 100),
        )
        direct = await live(hass, "130", True)
        refreshed = await live(hass, "130", True, core_refreshed=True)
        self.assertEqual(["update"], calls)
        self.assertTrue(direct["arm"])
        self.assertTrue(refreshed["arm"])

    async def test_mutation_requires_admin_before_accessing_vehicle_data(self) -> None:
        handler = self._handler("websocket_panel_fuel_calibration")
        errors = []
        connection = SimpleNamespace(
            user=SimpleNamespace(is_admin=False), send_error=lambda *args: errors.append(args)
        )
        await handler(None, connection, {"id": 1, "device_id": "130", "action": "start"})
        self.assertEqual("unauthorized", errors[0][1])

    async def test_mutation_only_accepts_discovered_vehicle_ids(self) -> None:
        handler = self._handler(
            "websocket_panel_fuel_calibration", _discover_vehicle_entities=lambda _: []
        )
        errors = []
        connection = SimpleNamespace(
            user=SimpleNamespace(is_admin=True), send_error=lambda *args: errors.append(args)
        )
        await handler(None, connection, {"id": 1, "device_id": "130", "action": "start"})
        self.assertEqual("not_found", errors[0][1])

    async def test_bootstrap_respects_fuel_entity_read_permission(self) -> None:
        handler = self._handler(
            "_async_attach_fuel_calibration",
            _fuel_state=lambda *_: SimpleNamespace(entity_id=FUEL_ID),
            POLICY_READ="read",
        )
        vehicle = {"device_id": "130"}
        user = SimpleNamespace(
            is_admin=False, permissions=SimpleNamespace(check_entity=lambda *_: False)
        )
        await handler(None, vehicle, user)
        self.assertNotIn("fuel_calibration", vehicle)

    async def test_report_times_includes_only_readable_vehicle_reports_and_calibrations(self):
        now = datetime(2026, 11, 9, tzinfo=UTC)
        raw_states = {
            FUEL_ID: SimpleNamespace(
                entity_id=FUEL_ID,
                state="67",
                attributes={"sensitive": "omitted"},
                last_reported=now,
                last_updated=now - timedelta(hours=1),
            ),
            "sensor.murano_130_battery": SimpleNamespace(state="12.4", last_updated=now),
            SECOND_FUEL_ID: SimpleNamespace(entity_id=SECOND_FUEL_ID, state="36", last_updated=now),
            "sensor.undiscovered": SimpleNamespace(state="untouched", last_updated=now),
        }
        vehicles = [
            {
                "device_id": "130",
                "entities": {"fuel": FUEL_ID, "battery": "sensor.murano_130_battery"},
            },
            {"device_id": "683", "entities": {"fuel": SECOND_FUEL_ID, "unknown": "sensor.missing"}},
        ]
        reports = self._handler(
            "_report_times",
            UTC=UTC,
            POLICY_READ="read",
            state_reported_at=lambda state: getattr(state, "last_reported", None)
            or state.last_updated,
        )

        async def shared_view(device_id, state, fuel_entity_id):
            return {"pending": {"before": {"entity_id": state.entity_id}, "started_at": device_id}}

        async def broken_view(*_):
            raise OSError("storage unavailable")

        service = SimpleNamespace(async_view=shared_view)
        attach = self._handler(
            "_async_attach_fuel_calibration",
            _fuel_state=lambda hass, vehicle: hass.states.get(vehicle["entities"]["fuel"]),
            _fuel_entity_id=lambda vehicle, state: state.entity_id,
            _panel_fuel_calibration=lambda _: service,
            HomeAssistantError=RuntimeError,
            _LOGGER=SimpleNamespace(exception=lambda *_: None),
            POLICY_READ="read",
        )
        handler = self._handler(
            "websocket_panel_report_times",
            _report_times=reports,
            _async_attach_fuel_calibration=attach,
            _discover_vehicle_entities=lambda _: deepcopy(vehicles),
        )
        results = []
        connection = SimpleNamespace(
            user=SimpleNamespace(
                is_admin=False,
                permissions=SimpleNamespace(
                    check_entity=lambda entity, _: entity != SECOND_FUEL_ID,
                ),
            ),
            send_result=lambda *args: results.append(args),
        )
        hass = SimpleNamespace(states=raw_states)
        await handler(hass, connection, {"id": 7})
        self.assertEqual(7, results[0][0])
        payload = results[0][1]
        self.assertEqual(
            {
                FUEL_ID: {"value": "67", "reported_at": now.isoformat()},
                "sensor.murano_130_battery": {"value": "12.4", "reported_at": now.isoformat()},
            },
            payload["reports"],
        )
        self.assertEqual({"130"}, payload["calibrations"].keys())
        self.assertEqual("130", payload["calibrations"]["130"]["pending"]["started_at"])

        service.async_view = broken_view
        await handler(hass, connection, {"id": 8})
        self.assertEqual((8, {"reports": payload["reports"], "calibrations": {}}), results[1])
