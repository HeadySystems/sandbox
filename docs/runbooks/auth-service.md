# Auth service runbook

## Required secrets
- `AUTH_COOKIE_SECRET`

## Optional but expected for full capability
- `FIREBASE_API_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

## Endpoints
- `GET /api/config`
- `GET /api/session`
- `POST /api/auth/email`
- `POST /api/auth/anonymous`
- `GET /oauth/google`
- `GET /oauth/github`
- `GET /oauth/google/callback`
- `GET /oauth/github/callback`
- `POST /api/logout`

## Failure patterns
- `redirect-not-allowlisted` means the target host is outside the server allowlist.
- `google-oauth-not-configured` or `github-oauth-not-configured` means provider credentials are missing.
- `invalid-oauth-state` means the flow cookie is absent, expired, or mismatched.
