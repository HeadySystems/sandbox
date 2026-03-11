# Zero-trust posture

## Enforced in bundle
- Signed auth cookies with `HttpOnly`, `Secure`, and `SameSite=Strict`.
- Signed, expiring OAuth flow cookies tied to redirect, state, nonce, and provider.
- Redirect allowlist enforcement at the auth service boundary.
- Shared service base with structured logging, bulkhead controls, health endpoints, and graceful shutdown.
- AutoContext access through service routes instead of client-managed tokens.

## Still deployment-bound
- mTLS and sidecar enforcement rely on the final Envoy and infrastructure deployment.
- Secret rotation and external credential storage remain environment responsibilities.
