# StarLine dashboard workspace

The native StarLine panel is phone-first, read-only, and source-independent.

## Current operating mode

While the standalone `starline_telemetry` API connection is being debugged, the panel can run in **core bridge mode** and read data from the existing Home Assistant `starline` integration.

The bridge resolves entities from the Home Assistant entity registry by stable StarLine `unique_id` values (`starline-{role}-{device_id}`), not by installation-specific `entity_id`. User-renamed entity IDs therefore remain supported.

When standalone telemetry becomes available, integration-owned roles (`{device_id}_{role}`) take precedence role-by-role. The panel layout does not change.

## Fixed navigation

1. **Обзор** — current vehicle summary, security, engine, resources.
2. **Охрана** — arm/lock state, alarm, doors, hood, trunk, hand brake.
3. **Двигатель** — engine state, autostart state, engine/cabin temperature, battery.
4. **Авто** — location, mileage, fuel, GSM/GPS and balance when exposed.
5. **Сервис** — OBD errors and diagnostic states exposed by the source.

## Safety boundary

The panel is **read-only even when the core StarLine integration exposes writable entities** such as lock, switches, buttons or services. It reads their current states but never calls vehicle-control services.

Unsupported or disabled entities are omitted instead of being manufactured as permanent `unavailable` cards.

## Entry point

Panel path: `/starline`

Logical parent: `Дом → Автомобили` (`house.vehicles`).
