# NikaS Specialized Panel UI Standard v1.3

**Status:** REQUIRED  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Canonical standards:** Shell v1.3 · Zoom v1.3 · Integration UI v1.4 · Frontend Delivery v1.1  
**Reference field implementation:** Stark SolarPower UI 0.5.6

## Ownership

This repository owns domain/integration UI, entities, telemetry, commands, cards and diagnostics. Shared NikaS standards own application-shell behavior and release invariants.

**Migration rule:** do not refactor domain UI during shell-only migration.

## Header and safe area

- Effective safe area is consumed exactly once.
- Header stays below Dynamic Island/notch; Bottom Tab Bar stays above Home Indicator.
- No device-specific safe-area constants.
- Permanent left Header control is **Home Assistant main-system menu `☰` only**.
- The control dispatches `hass-toggle-menu` with bubbling/composed semantics.
- Permanent Back, parent-route arrow, integration drawer or device action in the left rail are prohibited.
- If parent navigation is required, place it inside the work area.
- Title is geometrically centered; at most one global action occupies the right rail.
- Header/menu/right action remain native scale; touch targets are approximately 44×44 pt or larger.

## Peer Device Selector

When multiple peer physical devices exist, selector is persistent directly below Header and remains native scale.

- fixed peer order;
- selected peer never reorders;
- selected peer survives Bottom Tab changes;
- compact non-selected health indication is allowed;
- primary detailed content belongs only to selected peer;
- subordinate zones/channels/components are not automatically peer devices.

## Bottom Tab Bar

- 3–5 primary sections use one fixed full-width edge-attached Bottom Tab Bar;
- not a floating card/pill;
- safe-area-aware;
- icon + short readable label;
- final content scrolls fully above it;
- remains native scale.

## Zoom — gesture-only standard

Only working content scales. Header, Device Selector and Bottom Tab Bar do not.

Required:

- exactly **one** zoomable work viewport per panel instance;
- two-finger focal-point pinch;
- pan/scroll when enlarged;
- range **75–200%**, default **100%**;
- **no permanent `− / % / +` controls**;
- two-finger double tap resets scale and scroll to 100%/origin;
- pinch ending at **97–103%** snaps to exactly 100%;
- reset/snap briefly shows **`Масштаб 100%`**;
- selected scale persists locally per panel/client and per peer device where applicable;
- responsive layout is selected before zoom.

Shell reconciliation is idempotent across Home Assistant updates: no nested wrappers, duplicate gesture handlers/reset messages, blank abandoned areas or progressive content shrinking.

## State and visual semantics

- normal factual measurements use neutral typography;
- green/amber/red are reserved for confirmed semantic state;
- `unknown`, `unavailable`, stale or untrusted source never appear healthy;
- frontend consumes validated backend semantic states/threshold results instead of duplicating backend business logic;
- do not invent unsupported values;
- native HA more-info/history is preferred for factual detail when useful.

## Local visual assets

- critical artwork ships locally with integration;
- no CDN dependency;
- no Base64 image payload when normal asset is suitable;
- background/context art contains no live measurements/statuses;
- device art, SVG paths, labels, values and status overlays remain separate runtime layers;
- changed assets use release/build cache busting.

## Frontend delivery

- one stable production frontend entry module;
- historical/versioned source modules are build-time history, not runtime import chain;
- deterministic bundle rebuild when applicable;
- production URL cache-busted by UI/build version;
- panel registration and machine-readable manifest agree on route, UI version, entry module, assets, HA menu event and zoom/reset policy;
- declared assets exist in shipped package;
- JavaScript plus HACS/Hassfest/repository checks pass where applicable.

## Field acceptance

Primary acceptance is Home Assistant Companion App on iPhone Pro Max portrait.

Verify: safe area not missing/doubled; `☰` opens native HA menu; Header geometry; selector fit; first useful state; Bottom Tab clearance; pinch/pan; two-finger reset; 97–103% snap; `Масштаб 100%` confirmation; no shell duplication after repeated HA state updates; peer context/scale persistence; explicit unreliable states; more-info/global-action behavior.

> Canonical policy remains in `ha-contract-generated-ui`; newer canonical standards override this synchronized snapshot.
