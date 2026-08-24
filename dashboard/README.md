# StarLine dashboard workspace

The dashboard is generated from a semantic contract after the real Home Assistant entity IDs are known.

## Fixed architecture

1. **Status** — security state, openings, engine/ignition, vehicle location and key resources.
2. **Control** — intentionally read-only in this project. It may show contextual state but contains no vehicle command buttons.
3. **Diagnostics** — source freshness, GPS/GSM visibility, service state and integration health.

## Binding rule

Do not hard-code installation-specific entity IDs into the contract. Bind generated entities by integration domain, device and semantic role, then generate the Lovelace YAML from the resolved inventory.

## Next UI milestone

After the integration is installed against the real StarLine account:

1. capture the actual entity/device registry snapshot;
2. confirm which telemetry fields the specific StarLine device exposes;
3. bind semantic roles;
4. generate the first phone-first dashboard baseline;
5. compare it with the current StarLine panel and migrate only confirmed useful blocks.
