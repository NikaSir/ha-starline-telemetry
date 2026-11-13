# Changelog

Current branch version is [`0.7.0-beta004`](custom_components/starline_telemetry/manifest.json).

Existing version-specific notes remain under [`docs/`](docs/) and earlier project history remains in Git history; neither is reconstructed here.

## 0.7.0-beta004

- Search for a fuel increase up to seven hours after the receipt when the first hour has no suitable reading.

## 0.7.0-beta003

- Add retrospective full-tank calibration by receipt date, Moscow time and litres. Match fuel readings in Home Assistant Recorder and keep the receipt timestamp in the calibration journal.

## 0.7.0-beta002

- Balance both overview cards within the available portrait workspace on iPhone.
- Use fresh ignition telemetry in the overview when engine status is stale or unavailable. Keep the engine reading in the details.

## 0.7.0-beta001

- Shows Murano 130 and 683 together on **Сводка** with matched blue and black portraits. Keeps the vehicle selector on History, Trips and Diagnostics.
- Keeps the fixed shell and separates summary zoom from per-vehicle zoom. Patches telemetry in place and displays stale or unavailable values explicitly. Summary report times use Europe/Moscow.
- Adds administrator-only full-refuel recording in Diagnostics. Estimates use at least three compatible samples from the same percentage source. The raw reading remains visible in the vehicle details.

## Repository maintenance — 2026-09-14

- Add repository ownership, weekly dependency update configuration, editor defaults and an explicit update policy.
- Keep the integration and runtime version unchanged.
