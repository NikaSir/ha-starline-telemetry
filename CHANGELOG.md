# Changelog

Current branch version is [`0.7.0-beta009`](custom_components/starline_telemetry/manifest.json).

Existing version-specific notes remain under [`docs/`](docs/) and earlier project history remains in Git history; neither is reconstructed here.

## 0.7.0-beta009

- Restore the two-finger double tap reset to 100% and center reduced content.
- Keep the refresh action in the header, align the vehicle selector with the panel background, and contain receipt date and time fields on mobile.

## 0.7.0-beta008

- Adopt the updated NikaS header with full UI and installed integration versions. Use theme-aware refresh colors and show the request result on the same button.
- Add compact Home Assistant connection and fuel/battery freshness indicators to both car cards. Fit the ignition state and the average fuel consumption unit into the portrait summary.

## 0.7.0-beta007

- Show estimated average fuel consumption for each vehicle in **Сводка**. Use the last two confirmed full fills and corresponding Recorder odometer readings. Show the calculation period, litres, distance and reading times in **Подробнее**.

## 0.7.0-beta006

- Add colour scales for fuel and battery to both vehicle cards. The fuel fill follows the displayed percentage. The battery uses a voltage marker with ignition off, or a percentage fill when supplied by the sensor. Stale and unavailable readings use a neutral track.

## 0.7.0-beta005

- Search up to 24 hours after a receipt, stopping before the next saved receipt. Use labeled hourly Recorder intervals when raw states are unavailable.

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
