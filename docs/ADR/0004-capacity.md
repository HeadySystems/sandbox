# ADR 0004: Capacity guardrails

## Decision

Treat fib(20)=6765 as the current runtime ceiling and treat 10000 as an aspirational business target until live soak tests justify a higher hard limit.

## Why

The attached cognitive configuration defines 6765 while the attached directives also mention 10000. Runtime code should use one enforced number.
