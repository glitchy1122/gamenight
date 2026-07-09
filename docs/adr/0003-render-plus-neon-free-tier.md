# ADR-0003: Render free tier + Neon free Postgres

**Status:** accepted · **Date:** 2026-07-08

## Context
Hard requirement: $0 recurring. 2024–2026 killed several "free" tiers
(Heroku 2022, Railway 2023, Fly.io 2024; AWS moved to expiring credits).
Verified July 2026: Render still runs a genuine free web service (512MB,
sleeps after ~15min idle, 30–60s cold start); Neon offers free managed Postgres.

## Options considered
- Render + Neon (chosen): Docker deploys, managed TLS, DB survives app redeploys.
- Oracle Always-Free VM: more powerful, but full DevOps burden (patching, TLS,
  firewall) and anecdotal account-reclaim risk — poor fit for phase 0 of a study-season project.
- Koyeb / Northflank free tiers: viable fallbacks; documented as escape hatches.

## Decision
Render (Docker web service) + Neon (external Postgres). Keep-warm via agent
heartbeats + UptimeRobot. Portability is a standing requirement: one image,
one DATABASE_URL, nightly dumps — migration to any successor in under an hour.

## Consequences
Cold starts exist and are tolerated by design (agent reconnect backoff).
We accept provider risk consciously and rehearse the exit (SDD §25, §29).
