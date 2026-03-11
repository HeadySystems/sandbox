# Error catalog

| Error | Where it appears | Meaning | Usual fix |
|---|---|---|---|
| `redirect-not-allowlisted` | auth service | Redirect host is outside approved domains | Add valid domain to allowlist or correct the request |
| `invalid-oauth-state` | auth callback | Missing or mismatched signed flow cookie/state | restart login and confirm callback route/cookies |
| `google-oauth-not-configured` | auth launch | Google credentials missing | provide `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` |
| `github-oauth-not-configured` | auth launch | GitHub credentials missing | provide GitHub OAuth credentials |
| AutoContext `enriched: false` | middleware/service responses | No indexed sources matched the query | index sources or widen query/domain tags |
| Docker secret expansion failure | compose startup | required env vars absent | export required secrets before startup |
