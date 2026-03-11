# Heady auth runtime rebuild

## What changed
- Replaced client-side local session persistence with centralized auth launch behavior in `packages/auth-widget/auth-widget.js`.
- Removed browser storage persistence from `packages/auto-context/auto-context-bridge.js`; context now stays transient in memory and syncs only across active tabs/windows.
- Rebuilt `apps/auth/index.html` and `apps/auth/login.html` as central login surfaces that post to `/api/auth/email` and `/api/auth/anonymous`.
- Added `services/user-facing/heady-auth/` as the central auth relay service with signed cookie minting, Firebase Identity Toolkit support, and Google/GitHub OAuth launch plus callback handlers.
- Replaced the Drupal default-secret fallback with a required environment variable.
- Replaced the shared Consul loopback health registration example with a service-address based health URL.

## Remaining integration work
- OAuth completion still requires provider credentials and callback registration in Google and GitHub.
- Site-local cookie exchange for fully isolated custom domains still requires the final edge or backend deployment pattern to be chosen.
- Password and guest auth require a valid Firebase project and `FIREBASE_API_KEY` at deploy time.
