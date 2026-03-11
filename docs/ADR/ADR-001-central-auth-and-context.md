# ADR-001: Central auth and transient client context

## Status
Accepted

## Decision
Keep authentication centralized on the auth domain while keeping client-side context transient and non-sensitive.

## Why
- Auth cookies belong on the auth domain and should not be mirrored into browser storage.
- Cross-site context is useful for navigation and ecosystem continuity, but it should not behave like a durable client credential store.
- A signed flow cookie is the simplest way to carry OAuth state across provider redirects without exposing secrets to browser scripts.

## Result
- Session state uses signed cookies.
- OAuth state uses a signed short-lived flow cookie.
- Client context is in-memory and synchronized only across active windows/tabs.
