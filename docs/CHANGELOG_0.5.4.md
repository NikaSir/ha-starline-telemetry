# 0.5.4

- Adopted the complete NikaS specialized-panel UI standard v1.6 without reverting the v0.5.3 Summary, scene or security work.
- Mounted Header, peer selector, the single zoom viewport/canvas and Bottom Tab Bar as persistent native-scale chrome.
- Replaced routine telemetry-driven full redraws with one-frame-coalesced DOM patching.
- Added lazy per-tab/per-vehicle work-view caching so returning to History, Trips or Diagnostics reuses the same subtree and embedded map.
- Raised meaningful panel typography to the 12–25px envelope while retaining only the documented 9px route-schematic exception.
- Kept the optional two-level connection/freshness indicator disabled because it has not been requested for StarLine.
- Retained commit-based delivery from `main`; GitHub Releases remain outside the update process.
