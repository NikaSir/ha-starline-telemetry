# Repository ownership

`NikaSir/ha-starline-telemetry` is the single source of truth for the StarLine Home Assistant package.

It owns:

- the custom integration;
- the native `/starline` panel;
- frontend code and local panel assets;
- the UI contract;
- HACS delivery and validation.

The panel has no runtime or delivery dependency on `ha-contract-generated-ui` or another UI repository. During bridge mode it reads entity states from Home Assistant's existing `starline` integration through the Entity Registry; this is a data-source compatibility layer, not a repository dependency.
