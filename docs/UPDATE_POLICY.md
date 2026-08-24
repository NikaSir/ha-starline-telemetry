# Update policy

`ha-starline-telemetry` uses a commit-based update model.

## Source of truth

The deployment source is the `main` branch.

The project does **not** use GitHub Releases or release tags as an update channel. A successful change is delivered by merging it into `main` after validation.

## Update flow

1. Develop changes in a short-lived branch.
2. Open a pull request against `main`.
3. Require successful HACS validation and hassfest checks.
4. Merge the pull request, preferably with squash merge.
5. HACS downloads the selected current commit from `main`.
6. Restart Home Assistant when the changed custom component requires it.

## Version field

`custom_components/starline_telemetry/manifest.json` keeps an internal integration version for diagnostics and compatibility tracking. That version does not imply that a GitHub Release or tag must exist.

## Prohibited release mechanics

Do not add:

- GitHub Release automation;
- tag-driven publishing workflows;
- release archives as the normal HACS delivery path;
- documentation that instructs users to update from Releases.

If the delivery model is ever changed, this document and the README must be updated in the same pull request.
