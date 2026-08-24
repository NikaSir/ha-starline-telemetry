# Staged API diagnostics

The StarLine setup flow identifies the API stage that failed without exposing App Secret, account password, SLID token or SLNet cookie.

Setup stages:

- `app_code` — `GET /apiV3/application/getCode/`
- `app_token` — `GET /apiV3/application/getToken/`
- `user_login` — `POST /apiV3/user/login/`
- `webapi_auth` — `POST /json/v2/auth.slid`
- `user_info` — `GET /json/v2/user/{user_id}/user_info`

When a request fails, the config flow shows the stage in the UI and writes a sanitized warning to the Home Assistant log containing the stage plus HTTP/API status codes. Credentials and session tokens are never logged.
