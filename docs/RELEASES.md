# Update and release policy

## Current repository state

- `main` is the canonical source branch, and accepted changes reach it through reviewed pull requests after required checks pass.
- This branch targets [`0.7.0-beta004`](../custom_components/starline_telemetry/manifest.json). The integration, panel title, panel manifest and frontend cache key use the complete version. The NikaS checker requires the numeric base `0.7.0` in `.nikas-ui-standard.json`.
- At the 2026-09-14 audit baseline, this repository had no Git tags or GitHub Releases. Existing documentation describes a commit-based custom-HACS channel from `main`.
- End-to-end acceptance that HACS exposes and installs the current `main` state was not performed by that audit. A merged commit is accepted source, not confirmed user delivery, until verification succeeds in the target Home Assistant installation.

## Acceptance gate

Before an update is presented to users:

1. Repository tests, frontend bundle checks, HACS validation and Hassfest pass for the reviewed commit.
2. Verify both vehicles on the target Home Assistant instance and iPhone 15 Pro Max. Check the shared portrait overview, telemetry against Home Assistant entities, the parked and disarmed case, stale data, connection loss and recovery, zoom reset, and behavior after a Home Assistant restart.
3. The accepted commit SHA and integration version are recorded, and the previous accepted state remains available for rollback.
4. `CHANGELOG.md` or the linked version note describes the user-visible change.

Merging, publishing and installing a build in Home Assistant require separate approval.
