# Installation diagnostics

This project intentionally distinguishes setup failures so live installation testing does not collapse unrelated StarLine API problems into one generic error.

- `invalid_auth`: StarLine application/user/WebAPI authentication failed.
- `two_factor_not_supported`: StarLine ID requested MFA.
- `no_devices`: authentication succeeded, but StarLine returned neither owned nor shared devices.
- `cannot_connect`: network/API request failure after authentication.

Vehicle discovery uses `GET /json/v2/user/{user_id}/user_info`, matching the endpoint used by the current Home Assistant core StarLine integration. No vehicle-control endpoint is implemented.
