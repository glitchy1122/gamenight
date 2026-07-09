# ADR-0002: Modular monolith, not microservices

**Status:** accepted · **Date:** 2026-07-08

## Context
One maintainer, ~20 users, one free-tier 512MB instance. Real-time presence,
telemetry aggregation, and transactional scheduling in one product (SDD §5–6).

## Options considered
- Microservices: independent scaling/deploys, but N deployables, inter-service
  network failures, and distributed debugging — costs paid by one person, benefits
  designed for many teams.
- Single monolith, unstructured: fastest start; becomes a big ball of mud.
- **Modular monolith:** one deployable; boundaries enforced in-process by folder +
  interface + lint rules (SDD §7.1).

## Decision
Modular monolith. Modules: auth, users, presence, metrics, recommend, matches, notify, releases.

## Consequences
One thing to deploy and keep warm on the free tier. Extraction of a hot module
remains possible later because boundaries exist. Revisit only if a module's load
or team ownership genuinely diverges (unlikely before N≈100+ users).
