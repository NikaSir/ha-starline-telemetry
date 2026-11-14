# StarLine dashboard workspace

The native StarLine panel is phone-first, read-only, and source-independent.

## Current operating mode

While the standalone `starline_telemetry` API connection is being debugged, the panel runs in **core bridge mode** and reads data from the existing Home Assistant `starline` integration.

The bridge resolves entities from the Home Assistant entity registry by stable StarLine `unique_id` values (`starline-{role}-{device_id}`), not by installation-specific `entity_id`. User-renamed entity IDs therefore remain supported.

When standalone telemetry becomes available, integration-owned roles (`{device_id}_{role}`) take precedence role-by-role. The panel layout does not change.

## UI v0.7.0-beta006

The functional reference is the native StarLine mobile application, while colors, geometry and navigation remain aligned with the NikaS Home Assistant panel language.

1. **Сводка** — one card per vehicle, with Murano 130 above Murano 683 in phone portrait. Fuel, battery, engine, security and perimeter states are visible with details collapsed. Each card shows the most recent reliable Home Assistant report time in Moscow time and distinguishes stale and unavailable data.
2. **История** — the official read-only StarLine event journal when a usable session exists, with confirmed Home Assistant Recorder transitions as fallback.
3. **Поездки** — movement history derived from recorded `device_tracker` coordinates. Home Assistant's native Map card renders the 72-hour path; trip cards estimate travelled distance from recorded GPS points.
4. **Диагностика** — source, freshness, entity availability, entity bindings and fuel calibration.

History, Trips and Diagnostics retain the vehicle selector. The shared summary keeps a separate workspace zoom. The header and bottom navigation remain fixed.

## Fuel calibration

Use **Диагностика → Калибровка топлива** for the selected vehicle. A Home Assistant administrator can save observations from a fuel entity that reports percent.

To record a completed full refill later, open **Добавить полный бак по чеку** and enter the receipt date, Moscow time and litres. Home Assistant compares the last recorded baseline, looking back up to 24 hours, with the strongest recorded increase from five minutes before to 60 minutes after the receipt. If there is no suitable increase in that window, the search can use the first suitable increase within 24 hours after the receipt, including a report after a connection outage. Review the displayed values and timestamps before choosing **Сохранить заправку**. Search stops before the next saved receipt for that vehicle. If raw states are unavailable, adjacent hourly statistics can supply a pair. The panel labels each hourly interval and requires confirmation before using it for calibration.

To capture a refill live:

1. Before filling, choose **Зафиксировать показание до заправки** while the fuel report is fresh.
2. Fill to the first automatic pump cut-off. Enter **Литры по чеку** and optionally the verified tank capacity in litres. Choose **Бак заправлен** to record when filling ended.
3. Wait for a changed fuel reading after that mark. In bridge mode an administrator can use **Обновить** in the header to request a read-only StarLine refresh, including OBD data. Choose **Записать полный бак** within 30 minutes of marking the full tank. Use **Отменить запись** for a partial fill or an expired mark.

Home Assistant stores the samples per StarLine device. A repeated HA report of the same fuel value cannot complete the sample. The estimate requires at least three compatible full refuels from the active percentage source. The panel multiplies a fresh raw percentage by 100 divided by the median full-tank reading and bounds the estimate to 0–100%. The spread of full-tank readings and consistency with receipt volumes can suspend the estimate. A confirmed capacity enables an additional check against the receipt. The raw reading, its source and HA report time remain visible. While the panel is open, it refreshes report times and calibration state from HA every minute without querying StarLine. The calibration has no factory coefficient and sends no command to the vehicle.

## History and Recorder use

History prefers the official `POST /json/v2/device/{device_id}/events` read-only journal so event timestamps and official descriptions match StarLine. The request is cached, throttled and limited by a separate 150-request/day panel budget.

Recorder remains the fallback and the trip source:

- events: `/api/history/period` over 24 hours for security/perimeter/engine-related entities;
- trips: `/api/history/period` over 72 hours for the StarLine `device_tracker`;
- current and historical maps: Home Assistant's own `hui-map-card`.

The UI identifies whether a row time is the StarLine source timestamp or the later Home Assistant detection timestamp.

## Safety boundary

The panel reads vehicle telemetry even when the core StarLine integration exposes writable locks, switches or buttons. The administrator's calibration form writes observations only to Home Assistant storage.

`more-info` is intentionally blocked for `lock`, `switch` and `button` domains inside the panel. Unsupported or disabled entities are omitted instead of being manufactured as permanent `unavailable` cards.

## Entry point

The panel path is `/starline`.

The centered title opens the declared Home Assistant parent at `/home/overview`.
