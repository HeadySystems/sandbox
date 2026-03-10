<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/adr/0001-architecture-decision.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Architecture Decision Record: 0001 - Microservices Architecture

## Status
Accepted

## Context
We need to design the HeadySystems platform to reach maximum potential, scalability, resilience, observability, and developer experience. The requirements include 50+ microservices, 9 websites, 14+ skills, Drupal CMS, and a φ-scaled vector memory architecture.

## Decision
We decided to adopt a comprehensive microservices architecture organized around core domains (Inference, Memory, Agents, Orchestration, Security, Monitoring, Web, Data, Integration, Specialized).

Key decisions:
1.  **NATS JetStream** as the central event bus for durable asynchronous communication.
2.  **PgBouncer** for connection pooling across 50 services to pgvector, configured with Fibonacci limits (pool size 34/233).
3.  **Strict Content Security Policy (CSP)** and `__Host-` prefixed httpOnly cookies for maximum security.
4.  **CSL Confidence Gates** replacing boolean logic across the system to support confidence-weighted decisions (`{ include: 0.382, boost: 0.618, inject: 0.718 }`).
5.  **Fibonacci Sequence** (`1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233`) used consistently across the architecture for caching limits, connection pools, sliding window rate limits, timeouts, and retry exponential backoffs.

## Consequences
- Requires a robust service mesh and API Gateway (`heady-manager.js`).
- Introduces complexity in local development, necessitating clear onboarding scripts (`setup-dev.sh`) and detailed runbooks/docs.
- Greatly increases fault tolerance, security posture, and scalability by enforcing concurrent-equals logic rather than priority-based processing.
