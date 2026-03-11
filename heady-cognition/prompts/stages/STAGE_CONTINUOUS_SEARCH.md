# STAGE 18: CONTINUOUS_SEARCH — Continuous Search & Discovery

> **Pipeline Position**: Stage 18 (after OPTIMIZATION_OPS, before EVOLUTION)
> **Timeout**: 29034ms (φ⁷ × 1000)
> **Parallel**: Yes
> **Required**: No — runs when learning lane is active

---

## Purpose

Always-on search for new patterns, tools, techniques, research, public domain
innovations, competitive intelligence, and emerging best practices. The system
is **ALWAYS LOOKING** for ways to improve. Curiosity is a feature.

## Cycle

```
search → evaluate → absorb → integrate → propose
```

## Search Categories

### 1. New Tools & Libraries

- Sources: npm trending, GitHub trending, Hacker News
- Focus: Node.js ecosystem, AI/ML tooling, DevOps utilities
- Max daily queries: **fib(7) = 13** via Heady™Perplexity (Sonar Pro)

### 2. AI Research Papers

- Sources: arxiv.org, Papers with Code, Semantic Scholar
- Focus: Multi-agent systems, vector databases, LLM optimization, CSL-adjacent math
- Max daily: **fib(5) = 5** deep research queries via Heady™Research

### 3. Competitor Innovations

- What are other AI platforms doing?
- Track: Copilot, Cursor, Windsurf, Claude, Gemini, Devin, v0
- Abstract concepts — do not copy proprietary implementations

### 4. Security Advisories

- Sources: NVD, GitHub Security Advisories, npm audit
- Focus: New CVEs affecting Node.js, PostgreSQL, Redis, Docker
- Urgency: CRITICAL CVEs trigger immediate RECON re-scan

### 5. Performance Techniques

- New V8 engine optimizations
- Database query optimization patterns
- Edge computing innovations (Cloudflare Workers)
- Caching strategies

### 6. Architecture Patterns

- Emerging patterns in microservices, event-driven, serverless
- New approaches to multi-agent orchestration
- Novel vector storage and retrieval strategies

## Evaluation

Each discovery is scored using CSL:

- **Relevance**: `cos(discovery_embedding, heady_mission_embedding)`
- Must exceed **0.618 (1/φ)** to be absorbed
- Below threshold: discard (but log for future reference)

## Absorption

High-value findings are:

1. Embedded into vector memory under `discoveries` namespace
2. Tagged with discovery date, source, relevance score, category
3. Linked to relevant services/stages they could improve
4. Queued for review in next pipeline run's OPTIMIZE stage

## Output

```json
{
  "searchesPerformed": int,
  "discoveriesFound": int,
  "discoveriesAbsorbed": int,
  "discoveriesDiscarded": int,
  "topDiscoveries": [
    { "title": str, "source": str, "relevanceScore": float, "category": str, "proposedIntegration": str }
  ],
  "securityAdvisories": [{ "cve": str, "severity": str, "affected": str }],
  "proposedIntegrations": int
}
```

## Sacred Rules

- Daily queries (Sonar Pro): fib(7) = 13
- Daily deep research: fib(5) = 5
- Relevance threshold: 1/φ = 0.618
- Search interval: φ⁸ × 1000 = 46979ms (~47s between searches)
- Max discoveries per run: fib(6) = 8
- Timeout: φ⁷ × 1000 = 29034ms
- NEVER copy proprietary implementations — abstract concepts only
- Adaptation rule: make discoveries more mission-aligned, more owner-friendly
