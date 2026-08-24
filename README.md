# StarLine Telemetry for Home Assistant

Read-only StarLine telemetry integration and dashboard for Home Assistant — vehicle status, location, security, power and diagnostics.

## Project scope

This repository intentionally separates **telemetry** from **vehicle control**.

Implemented scope:

- StarLine Open API authentication;
- discovery of vehicles linked to the StarLine account;
- read-only polling through `GET /json/v3/device/{device_id}/data`;
- Home Assistant sensors, binary sensors and GPS device tracker;
- redacted diagnostics;
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

## Current baseline

Internal integration version: `0.1.0`

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

### Manual

Copy:

`custom_components/starline_telemetry`

to:

`<config>/custom_components/starline_telemetry`

Restart Home Assistant and add **StarLine Telemetry** from **Settings → Devices & services → Add integration**.

### Credentials

StarLine requires an Open API application. Obtain `AppId` and `Secret` in the developer section of `my.starline.ru`, then configure the integration with:

- App ID;
- App Secret;
- StarLine account login;
- StarLine account password.

The password is SHA-1 hashed before it is stored in the Home Assistant config entry. The App Secret must remain available to renew StarLine application tokens and is stored as a secret configuration value.

> Two-factor authentication is not supported in the `0.1.0` baseline. It is tracked as a follow-up item before this baseline is considered validated for regular use.

## Dashboard

The dashboard is developed separately from the transport layer but lives in the same repository. See:

- `contracts/starline_ui_contract.yaml`
- `dashboard/README.md`

The UI architecture follows: **Status → Control → Diagnostics**. For this project the **Control** section is informational/read-only; no vehicle command is exposed.

## Development principles

1. Read-only by construction: the API client contains no vehicle-control methods.
2. One coordinated snapshot per vehicle per update cycle.
3. API quota is treated as a design constraint.
4. Raw credentials, tokens and coordinates are removed from diagnostics.
5. Unsupported telemetry is omitted instead of represented as permanent `unavailable` entities.
6. Dashboard entity binding is contract-driven rather than hard-coded to one installation.
7. Delivery is commit-based from `main`; GitHub Releases are not part of the update process.

## License

MIT
