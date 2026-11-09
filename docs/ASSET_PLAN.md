# StarLine panel assets

The `0.7.0-beta001` summary uses two local WebP portraits on a shared canvas. The blue Murano uses the black Murano's silhouette, proportions and camera angle with a recolored body.

## Production portraits

- `frontend/assets/starline-car-130-v2.webp` — transparent dark-blue Nissan Murano Z52 layer.
- `frontend/assets/starline-car-683-v2.webp` — transparent black Nissan Murano Z52 layer.

Both files are 1866 × 843 pixels. The summary loads each portrait when its card mounts and renders telemetry as separate UI elements.

Portraits are served from `NikaSir/ha-starline-telemetry` with the full UI version in the URL query. The production asset list in `panel_manifest.json` is checked by CI. The older scenery and state-dependent assets belong to the 0.6.x layouts.
