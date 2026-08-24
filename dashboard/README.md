# StarLine dashboard workspace

The native StarLine panel is phone-first, read-only, and source-independent.

## Current operating mode

While the standalone `starline_telemetry` API connection is being debugged, the panel runs in **core bridge mode** and reads data from the existing Home Assistant `starline` integration.

The bridge resolves entities from the Home Assistant entity registry by stable StarLine `unique_id` values (`starline-{role}-{device_id}`), not by installation-specific `entity_id`. User-renamed entity IDs therefore remain supported.

When standalone telemetry becomes available, integration-owned roles (`{device_id}_{role}`) take precedence role-by-role. The panel layout does not change.

## UI v0.2 information architecture

The functional reference is the native StarLine mobile application, while colors, geometry and navigation remain aligned with the NikaS Home Assistant panel language.

1. **Состояние** — vehicle selector and online state, compact GPS/GSM/battery/fuel/temperature/mileage telemetry, vehicle mnemonic, perimeter/security/engine state, latest significant event and current map.
2. **История** — a StarLine-oriented event timeline built from the Home Assistant Recorder history API. It does not call the StarLine event-history cloud API.
3. **Поездки** — movement history derived from recorded `device_tracker` coordinates. Home Assistant's native Map card renders the 72-hour path; trip cards estimate travelled distance from recorded GPS points.
4. **Диагностика** — source, freshness, entity availability, Recorder cache and entity bindings.

## Recorder use

History and trips are local Home Assistant reads:

- events: `/api/history/period` over 24 hours for security/perimeter/engine-related entities;
- trips: `/api/history/period` over 72 hours for the StarLine `device_tracker`;
- current and historical maps: Home Assistant's own `hui-map-card`.

This does not consume StarLine Open API quota beyond whatever the active source integration already uses.

## Safety boundary

The panel is **read-only even when the core StarLine integration exposes writable entities** such as lock, switches, buttons or services. It reads their current states but never calls vehicle-control services.

`more-info` is intentionally blocked for `lock`, `switch` and `button` domains inside the panel. Unsupported or disabled entities are omitted instead of being manufactured as permanent `unavailable` cards.

## Entry point

Panel path: `/starline`

Logical parent: `Дом → Автомобили` (`house.vehicles`).
