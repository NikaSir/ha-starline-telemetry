# StarLine specialized-panel compliance

Audit target: UI 0.7.0-beta008 / integration 0.7.0-beta008 against NikaS Standard v2.2, Navigation Contract v1.3, Shell Contract v2.1 and Refresh Action Contract v1.3.

| Requirement | Status | Evidence / field acceptance |
|---|---|---|
| Integration-owned route and autonomous production entry | PASS | `panel.py`, `panel_manifest.json` and `.nikas-ui-standard.json` agree on `/starline`, `starline-app.js` and `starline-app-panel`. |
| Host-bounded shell | PASS | The component owns exactly the Home Assistant panel body: no viewport-sized shell and no duplicate fixed navigation. |
| Header / selector / Bottom Tab Bar geometry | CI / FIELD CHECK | Uses the vendored NikaS shell. Chromium checks the header and version line from 320 px and the standard viewport matrix in both themes. |
| Content width and viewport matrix | PASS / FIELD CHECK | Content is capped at 1280 px; verify the canonical phone, tablet and desktop matrix after HACS delivery. |
| Native internal scrolling | PASS / FIELD CHECK | The internal `.viewport` is the sole vertical scroller at 100%; verify long History, Trips and Diagnostics screens on iPhone. |
| Shell boundary guard | PASS / FIELD CHECK | Capturing non-passive single-touch guard blocks top/bottom scroll chaining, leaves multitouch to zoom and is removed on disconnect. |
| Stable shell and point patching | PASS | Header, selector, viewport/canvas and Bottom Tab Bar mount once; telemetry updates remain requestAnimationFrame point patches. |
| Vehicle selector status lamps | CI / FIELD CHECK | Accessible lamps report connection, data quality and confirmed alarm independently of selection. |
| Compact summary indicators | CI / FIELD CHECK | Home Assistant connection and per-car fuel/battery freshness update in place. Diagnostics shows the same statuses in text. |
| Refresh feedback | CI / FIELD CHECK | Chromium exercises the production button, request result, slow response, repeat activation, reduced motion and scroll preservation. Live Home Assistant field acceptance remains open. |
| Zoom contract | PASS / FIELD CHECK | 75–200%, native scroll through 100%, pan only above 100%, focal pinch, fit-axis locks, persistent per-vehicle state and two-finger reset are preserved. |
| Safe title navigation | PASS | The StarLine title returns to the declared main parent at `/home/overview`. The version line shows the full frontend and installed manifest versions. |
| Data truth and commands | PASS | Reliable Home Assistant security state is authoritative; bootstrap is initial-only and expires after 60 seconds; discrete telemetry preserves true/false/unknown; no Home Assistant service call. |
| Deterministic frontend delivery | PASS | `scripts/build_frontend_bundle.py` combines the pinned NikaS shell and StarLine source into one autonomous bundle. |
| Canonical documentation | PASS | The repository pins the NikaS UI, navigation and refresh contracts and the exact build-time shell source. |
| Packaged integration identity | PASS | The approved local integration icon and NikaS StarLine identity are unchanged. |

## Required field acceptance

1. Phone portrait and landscape: pull-down at the upper boundary must not refresh Home Assistant; upward drag at the lower boundary must not move the whole panel.
2. Tablet portrait and landscape plus desktop: header, selector and bottom navigation must stay inside the panel host with no clipping.
3. All four tabs: long content scrolls only inside the work area at 100%; tabs, title return and refresh remain responsive.
4. Both vehicles: compare the indicators, selector lamps, text and report times with the Home Assistant states for both cars, including fresh, stale and missing readings.
5. Zoom: one-finger native scroll at 100%, focal pinch, axis locking above 100% and two-finger reset.
