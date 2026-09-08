# StarLine Telemetry 0.6.9

- Registers the native `/starline` panel before bridge dependency checks and all
  fallible standalone cloud operations.
- Keeps the application route available while authentication, discovery or the
  initial telemetry refresh is retrying; entities retain their existing setup flow.
- Adds a static lifecycle regression test to repository CI.
- Leaves the read-only API, entity model, panel bundle and UI version unchanged.
