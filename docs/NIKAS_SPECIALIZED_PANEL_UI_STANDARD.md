# NikaS Specialized Panel UI Standard v1.3

**Status:** REQUIRED  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Field reference:** Stark SolarPower mobile panel

## Shell baseline

Safe area is consumed exactly once. Permanent left Header control is Home Assistant `☰` and MUST dispatch `hass-toggle-menu`; it is never Back/integration drawer/device action. Parent navigation belongs inside work area. Title is viewport-centered. Header, optional peer-device selector and fixed full-width Bottom Tab Bar remain native scale.

## Zoom baseline

- exactly one zoomable work viewport;
- two-finger focal-point pinch + pan/scroll;
- no permanent `− / % / +` toolbar;
- pinch end at **97–103%** → exact **100%**;
- two-finger double tap resets scale + work-area scroll to **100%**;
- brief native feedback `Масштаб 100%` after reset;
- local persistence per panel/client, preferably per peer device where applicable;
- idempotent lifecycle: never re-wrap an existing zoom viewport; no nested wrappers, duplicate handlers, blank wrapper space or progressive shrinkage after HA rerenders.

## Cross-panel Stark lessons

Normal data is visually neutral; semantic colors represent confirmed state. `unknown`/`unavailable`/stale/source loss never appear healthy. Backend semantic thresholds remain authoritative. Critical artwork is local, optimized, cache-busted and separate from live runtime layers; no external CDN/Base64 production images. Prefer native HA more-info/history. Avoid full rebuilds for unrelated HA churn. Production frontend uses deterministic entry bundle and CI checks.

**Migration rule:** do not refactor domain UI while adopting shell v1.3.

> Canonical documents in `ha-contract-generated-ui` win on conflict.