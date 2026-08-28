<p align="center">
  <img src="custom_components/starline_telemetry/brand/icon.png" width="112" height="112" alt="StarLine Telemetry icon">
</p>

# StarLine Telemetry for Home Assistant

Read-only StarLine telemetry integration and dashboard for Home Assistant — vehicle status, location, security, history, trips and diagnostics.

## Project scope

This repository intentionally separates **telemetry** from **vehicle control**.

Implemented scope:

- StarLine Open API authentication;
- discovery of vehicles linked to the StarLine account;
- read-only polling through `GET /json/v3/device/{device_id}/data`;
- Home Assistant sensors, binary sensors and GPS device tracker;
- redacted diagnostics;
- a native read-only StarLine panel with a compatibility bridge to the Home Assistant core `starline` integration;
- exact read-only event history through the official StarLine journal when an SLNet session is available;
- confirmed Home Assistant Recorder transitions as the history fallback;
- local trip reconstruction through recorded `device_tracker` coordinates;
- Home Assistant native map rendering for current position and movement history;
- a semantic UI contract and dashboard workspace.

Explicitly out of scope:

- arm/disarm commands;
- engine start/stop;
- heater/Webasto control;
- comfort/settings changes;
- any other vehicle write command.

Authentication itself uses the POST endpoints required by StarLine ID/WebAPI. No vehicle-control endpoint is implemented by this integration.

## API quota strategy

The public StarLine Open API documents a limit of **1000 requests/day per user** for private users. The coordinator reserves quota headroom and calculates its poll interval from the number of discovered vehicles. The minimum poll interval is 180 seconds and the polling budget is capped at approximately 800 device-data requests/day across the account.

The History view may use the official read-only StarLine event-journal request so it can show source timestamps and source descriptions. Requests are cached, force-refresh is throttled, and the panel has a separate 150-request/day ceiling. Together with the approximately 800-request telemetry budget, this preserves quota headroom. If the read-only journal is unavailable, the panel falls back to confirmed Home Assistant Recorder state transitions. Trips remain local to Recorder.

In core-bridge mode, the request reuses the active core StarLine SLNet session inside Home Assistant. The token is never returned to the browser, logged, or included in diagnostics.

## Current baseline

Internal integration version: `0.6.1`

Platforms:

- `sensor`
- `binary_sensor`
- `device_tracker`

Initial telemetry mapping includes, when provided by the device:

- vehicle battery / battery level;
- cabin and engine temperature;
- GPS satellite count;
- GSM level;
- fuel level and fuel volume;
- odometer value;
- last activity timestamp;
- armed, alarm, door, hood, trunk, ignition, engine-running and service-mode states;
- GPS position and accuracy.

Entities are created only when the corresponding field is present in the first device snapshot, to avoid filling Home Assistant with permanently unavailable entities.

## Update model

The project uses **commit-based updates from `main`**.

- `main` is the deployment source of truth;
- changes are validated in a pull request and then merged into `main`;
- HACS downloads the current selected commit from `main`;
- GitHub Releases are not used;
- release tags are not used as the update channel;
- the `version` field in `manifest.json` is an internal integration version only.

After HACS downloads a changed custom component, restart Home Assistant before testing the new code.

See [`docs/UPDATE_POLICY.md`](docs/UPDATE_POLICY.md) for the repository policy.

## Installation

### HACS

Add `https://github.com/NikaSir/ha-starline-telemetry` to HACS as a custom repository with category **Integration**. Download **StarLine Telemetry**, restart Home Assistant, then add it from **Settings → Devices & services → Add integration**. Delivery is commit-based from `main`; GitHub Releases and release tags are not used as the update channel.

### Manual

Copy:

`custom_components/starline_telemetry`

to:

`<config>/custom_components/starline_telemetry`

Restart Home Assistant and add **StarLine Telemetry** from **Settings → Devices & services → Add integration**.

### Existing StarLine bridge

If Home Assistant already has the standard **StarLine** integration configured, choose:

**Use the existing Home Assistant StarLine integration**

This creates a panel-only bridge entry. No App ID, App Secret, login or password is requested. The native panel discovers StarLine entities through the Home Assistant entity registry using stable StarLine `unique_id` values and groups them by vehicle.

Bridge mode is strictly read-only. Writable entities exposed by the standard StarLine integration may be used as state sources, but the panel does not call their services and blocks more-info for `lock`, `switch` and `button` domains.

### Standalone telemetry credentials

For the standalone telemetry source, StarLine requires an Open API application. Obtain `AppId` and `Secret` in the developer section of `my.starline.ru`, then configure the integration with:

- App ID;
- App Secret;
- StarLine account login;
- StarLine account password.

The password is SHA-1 hashed before it is stored in the Home Assistant config entry. The App Secret must remain available to renew StarLine application tokens and is stored as a secret configuration value.

> Two-factor authentication is not supported in the current baseline. It is tracked as a follow-up item before standalone telemetry is considered validated for regular use.

## Dashboard

The native panel lives at `/starline` and uses the fixed phone-first navigation:

**Сводка → История → Поездки → Диагностика**

### Сводка

The daily-use screen follows the information hierarchy of the native StarLine mobile application while keeping the NikaS Home Assistant visual language:

- separate initial pages for 130 and 683, selected by the fixed vehicle selector;
- one full-height vehicle card and its online status per page;
- state-aware vehicle imagery for running engine, open doors, open hood and open trunk;
- independent static fields for armed, alarm and unavailable states;
- compact GPS, GSM, battery, fuel, cabin/engine temperature and parking telemetry;
- vehicle mnemonic with security, engine and perimeter state;
- latest significant StarLine state event without adding write controls.

### История

The timeline prefers the official StarLine event journal for the last 24 hours. This preserves the event timestamp and the official event description, including an action source such as a штатный брелок when StarLine returns it. If no usable StarLine session is available, the timeline uses Home Assistant Recorder and explicitly identifies the displayed time as the moment Home Assistant detected the state transition.

### Поездки

The 72-hour movement view uses the recorded StarLine `device_tracker` history. Home Assistant's native Map card renders the historical path, while the panel groups GPS points into trips and estimates travelled distance using the haversine formula.

The safe fallback parent is `/dashboard-house`; when opened from an approved base panel, the title returns to that originating route.

Data source priority is role-by-role:

1. `starline_telemetry` entities when available;
2. Home Assistant core `starline` entities as the compatibility source.

The layout does not change when the source is migrated.

See:

- `contracts/starline_ui_contract.yaml`
- `dashboard/README.md`

## Development principles

1. Read-only by construction: the API client contains no vehicle-control methods.
2. One coordinated snapshot per vehicle per update cycle.
3. API quota is treated as a design constraint.
4. Raw credentials, tokens and coordinates are removed from diagnostics.
5. Unsupported telemetry is omitted instead of represented as permanent `unavailable` entities.
6. Dashboard entity binding is registry/contract-driven rather than hard-coded to one installation.
7. Delivery is commit-based from `main`; GitHub Releases are not part of the update process.
8. The native panel remains read-only even when its compatibility source exposes writable entities.
9. Event history uses only the official read-only StarLine journal endpoint, under a separate quota ceiling, with Recorder as a state-transition-only fallback.
10. Corresponding panel typography is never smaller than the official StarLine mobile application reference.
11. The UI follows NikaS specialized-panel standard v1.7: one fixed shell, one transform canvas, cached views and point telemetry patches without routine DOM remounts.

## License

MIT
