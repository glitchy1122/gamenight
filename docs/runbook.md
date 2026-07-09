# Runbook

## Deploy
Push to `main` → CI green → Render auto-deploys from the Blueprint. Rollback: Render dashboard → previous deploy → "Rollback".

## Secrets
All secrets live in Render env vars (and a local `.env`, gitignored). Rotation procedure: TBD Phase 1 (Google client secret).

## Restore drill (quarterly, SDD §29)
TBD Phase 1 when the first real table exists: restore latest `pg_dump` artifact into a scratch Neon branch, run smoke queries, record time taken.

## Known operational facts
- Free instance sleeps after ~15 min idle; first request pays 30–60 s.
- `/healthz` = liveness (UptimeRobot target). `/healthz/db` = readiness.
