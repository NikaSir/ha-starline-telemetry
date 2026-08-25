# NikaS Specialized Panel UI Standard v1.2

**Status:** REQUIRED  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Canonical standards:** Shell v1.2 · Zoom v1.2 · Integration UI v1.3 · Frontend Delivery v1.0  
**Local role:** synchronized implementation snapshot; do not create repository-specific variants.

## Ownership boundary

This repository owns its domain/integration UI: entities, telemetry, commands, cards, visualizations, device/domain semantics and diagnostics.

The shared NikaS contract owns application-shell behavior: effective safe areas, permanent Home Assistant menu Header, peer-device context placement, exactly one zoomable work viewport, optional zoom controls, fixed Bottom Tab Bar and frontend release invariants.

**Migration rule:** do not refactor domain UI while adopting a new shell revision. Domain behavior must remain functionally unchanged during shell-only migration.

## Header and safe area

- Safe-area inset has exactly one effective owner; do not add the same top/bottom inset twice.
- No title/control may render under a notch or Dynamic Island.
- No Bottom Tab Bar may render under the iOS Home Indicator.
- Do not use device-model offsets such as `top: 47px`.
- **Permanent left Header control is always the Home Assistant main-system menu (`☰`), never Back and never an integration-specific drawer.**
- Title is geometrically centered; one shell/global action may occupy the right rail.
- Header touch targets are approximately 44×44 pt or larger.
- Header remains at native scale.

Logical parent/drill-down navigation may exist elsewhere but does not replace the permanent HA menu rail.

## Peer Device Selector

When the application owns multiple peer physical devices, the selector is a persistent native-scale layer directly below Header.

Required:

- fixed peer order;
- selection never reorders devices;
- selected peer survives Bottom Tab changes;
- compact non-selected health indication is allowed;
- primary detailed content belongs only to the selected peer;
- no duplicate full blocks for every peer below the selector.

Subordinate channels/zones/components are not automatically peer devices.

## Bottom Tab Bar

- 3–5 primary sections use one full-width fixed edge-attached Bottom Tab Bar.
- It is not a floating card/pill.
- It respects the effective bottom safe area.
- Active tab is unambiguous; icon + short readable label.
- Final content scrolls fully above the bar.
- Bottom Tab Bar remains at native scale.

## Zoom

Every touch-specialized panel supports **two-finger focal-point pinch**, pan/scroll when enlarged and persistent scale.

Defaults: **75–200%**, default **100%**.

Exactly **one** zoomable work viewport may exist per panel instance. Shell installation/reconciliation must be idempotent across Home Assistant state updates and rerenders: no nested wrappers, repeated controls, blank abandoned regions or progressive shrinking.

On-screen `− / percentage / +` controls are an **optional shell presentation policy**, not a mandatory domain feature. When enabled they:

- exist exactly once;
- stay outside the scaled viewport;
- use a 10% step;
- show effective percentage;
- reset to 100% when percentage is tapped.

Gesture-only mobile zoom is conforming when declared and field-accepted.

Persistence scope:

- single-device: panel + client;
- multi-peer-device: panel + peer device + client is allowed/preferred when useful.

Responsive mobile/tablet/desktop composition is selected before user zoom.

## Visual/state semantics

- Normal factual measurements use neutral typography.
- Green/amber/red are reserved for confirmed semantic health/warning/fault meaning.
- `unknown`, `unavailable`, stale or untrusted source never appear healthy.
- If backend exposes a validated semantic state/threshold result, frontend consumes it instead of duplicating backend business logic.
- Do not invent unsupported runtime, watts, alarms, reserve estimates or entity facts.
- Native Home Assistant more-info/history is preferred for factual detail when it meets the need.

## Local visual assets

Panel-critical art ships locally with the integration.

- no external CDN dependency;
- no Base64 image payload in production JS when a normal asset is suitable;
- decorative/background art contains no live measurements or statuses;
- device art, SVG paths, labels, values and state overlays remain separate runtime layers;
- context background may change with selected peer/device;
- use release/build query cache busting for changed assets.

## Frontend delivery

Integration-owned custom panels use one stable production frontend entry module.

Required release principles:

- historical/versioned source modules may remain build-time history but are not a runtime import chain;
- deterministic bundle rebuild when a bundle is generated;
- production entry URL changes cache identity with UI release;
- panel registration and machine-readable panel manifest agree on route, UI version, production entry and assets;
- declared assets exist in the shipped package;
- JavaScript syntax, HACS/Hassfest/repository checks run where applicable.

## Render stability

Avoid full UI rebuilds for unrelated Home Assistant entity churn when practical. Any optimization must preserve exactly one shell/work viewport, selected peer, active tab, zoom state and entity/action bindings.

## Field acceptance

Primary acceptance is the Home Assistant Companion App on iPhone Pro Max portrait, then smaller iPhone, tablet and desktop.

Verify:

- safe area is neither missing nor doubled;
- HA menu remains available on the left;
- Header/title/right action geometry;
- selector fit/context where applicable;
- first useful operating state is visible at intended density;
- Bottom Tab Bar clearance;
- pinch/pan/persistence;
- no shell duplication after repeated HA updates;
- peer switching preserves context;
- stale/source-loss/unknown states remain explicit;
- more-info and global action feedback work where specified.

## Prohibited patterns

Do not introduce permanent Back or integration drawer in the left Header rail, double safe-area padding, repository-specific shell geometry, nested zoom wrappers, duplicated zoom controls, whole-page browser zoom, hard-coded notch/Home-Indicator offsets, live data baked into artwork, runtime historical-module chains, or unrelated domain refactoring during shell migration.

> Canonical policy remains in `ha-contract-generated-ui`. If this snapshot conflicts with a newer canonical standard, the canonical standard wins and this local copy must be synchronized.
