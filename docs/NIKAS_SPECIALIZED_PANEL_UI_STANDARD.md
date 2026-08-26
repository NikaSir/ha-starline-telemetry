# NikaS Specialized Panel UI Standard v1.4

**Status:** REQUIRED  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Canonical standards:** Shell v1.4 · Zoom v1.4 · Integration UI v1.5 · Frontend Delivery v1.2  
**Reference field implementation:** Stark SolarPower 1.8.10

## Shell

- Effective safe area is consumed exactly once.
- Permanent left Header control is Home Assistant `☰` only and dispatches `hass-toggle-menu`.
- Back, parent arrow, integration drawer and device action are prohibited in that rail; parent navigation belongs inside work content.
- Header, optional peer-device selector and fixed full-width Bottom Tab Bar remain native scale.
- Exactly one fixed work-canvas viewport exists.

## Transform-owned canvas

- Only work content transforms through `translate3d(x,y,0) scale(s)`.
- Durable state is `{scale,x,y}`, never `scrollLeft` / `scrollTop`.
- CSS `zoom`, page zoom and native overflow scrolling are not canvas position engines.
- One finger pans at any scale, including vertical movement at 100%.
- Two fingers pinch around their midpoint.
- Coordinates are clamped to real scaled-content bounds.
- Final transform remains after release.
- State persists locally per panel/client and peer device where applicable.
- Telemetry rerender restores transform on new DOM before the visible frame.
- Installation is idempotent: no nested wrappers, duplicate handlers, blank areas or progressive shrink.

## Interaction guard

- A second finger immediately blocks pending `more-info`.
- Pan threshold cancels pending hold through `pointercancel` semantics.
- Synthetic clicks after gestures are briefly suppressed.
- Pinch/pan/reset never execute device actions.
- Stationary intentional long press still opens native `more-info`.

## Reset

- No permanent `− / % / +` controls.
- Two-finger double tap resets `{scale:1,x:0,y:0}`.
- Pinch ending at 97–103% snaps to exact 100%/origin.
- Reset/snap briefly shows native-scale `Масштаб 100%`.

## Semantics and delivery

- Normal measurements are neutral; semantic colors express confirmed state.
- `unknown`, `unavailable`, stale or untrusted source never appears healthy.
- Backend semantic thresholds remain authoritative; unsupported values are not invented.
- Critical artwork is local, cache-busted and separate from live state layers.
- Production frontend is one deterministic self-contained entry with manifest/registration parity.

## Acceptance

Field-check iPhone Companion App: safe area, `hass-toggle-menu`, native Header/selector/Bottom Tab, one canvas, persistent one-finger movement at 100%, focal-point pinch, real bounds, reset/snap/feedback, pre-paint restoration, accidental-detail suppression, stationary long press, explicit unreliable states and no shell duplication after repeated HA updates.

> Canonical policy remains in `ha-contract-generated-ui`; newer canonical standards override this synchronized snapshot.

