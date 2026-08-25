# StarLine panel assets

Version 0.4.2 replaces the structural SVG placeholders with production photorealistic local raster assets while preserving the same layered contract.

Production files:

- `frontend/assets/starline-bg-130-v2.webp` — daytime waterfront/city background, no car, text, values or UI.
- `frontend/assets/starline-car-130-v2.webp` — transparent dark-blue Nissan Murano Z52 layer.
- `frontend/assets/starline-bg-683-v2.webp` — daytime modern-house/driveway background, no car, text, values or UI.
- `frontend/assets/starline-car-683-v2.webp` — transparent black Nissan Murano Z52 layer.

Rules:

- assets are stored only in `NikaSir/ha-starline-telemetry`;
- no CDN or external image host;
- no Base64 in JavaScript;
- all telemetry and state remain live Home Assistant UI layers;
- URLs use a version query for cache invalidation;
- `panel_manifest.json` must list every production asset and CI must verify them.
