# Phase 0 Guide — From Zip to Live URL

**Goal (Milestone M0):** `git push` → your live URL updates automatically, `/healthz/db` says `ok` against Neon, and you have rehearsed one teardown/redeploy.

What's already built and tested in this package: monorepo skeleton, Fastify server (`/healthz`, `/healthz/db`, `/api/v1/hello`, static page), strict TypeScript, ESLint + Prettier, multi-stage Dockerfile, docker-compose, Render Blueprint, GitHub Actions CI, three seeded ADRs, runbook. The steps below are yours.

---

## Step 1 — Local proof (10 min)

```powershell
# Requires Node 22: https://nodejs.org (LTS). Check with: node --version
cd gamenight
npm install
npm run dev
```

Open http://localhost:8080 — you should see the GameNight page. Then in another terminal:

```powershell
curl http://localhost:8080/healthz
curl http://localhost:8080/healthz/db     # "skipped" — no DATABASE_URL yet, by design
curl http://localhost:8080/api/v1/hello
```

**Learn while you're here:** run `netstat -ano | findstr :8080` and find your process listening on `0.0.0.0:8080`. That's a TCP socket in LISTEN state bound to all interfaces — CCNA transport layer, live on your own machine. Try changing `HOST` to `127.0.0.1` in a `.env`-less experiment (`$env:HOST="127.0.0.1"; npm run dev`) and notice another PC on your LAN can no longer reach it. Binding address ≠ firewall — nothing is "blocked," the socket simply doesn't exist on that interface.

## Step 2 — Docker locally (15 min, optional but recommended)

Install Docker Desktop, then:

```powershell
docker compose -f infra/docker-compose.yml up --build
```

This runs the *exact image Render will run*, plus a local Postgres. Now `curl http://localhost:8080/healthz/db` should return `"status":"ok"` with an `rtt_ms` — your first containerized service talking to a containerized database over Docker's internal network (note the hostname in the connection string is `db`, not `localhost`: Docker's embedded DNS resolves service names — DNS, another CCNA topic, working for you invisibly).

## Step 3 — GitHub (10 min)

1. Create a **public** repo named `gamenight` (public = free CI minutes + auditable agent builds later, SDD §8.4).
2. ```powershell
   git init
   git add .
   git commit -m "feat: phase 0 skeleton — server, docker, ci, adrs"
   git branch -M main
   git remote add origin https://github.com/<you>/gamenight.git
   git push -u origin main
   ```
3. Open the **Actions** tab — the `ci` workflow should run and go green (lint → typecheck → build → docker build). From now on, red CI = do not merge. That pipeline is your co-reviewer.

## Step 4 — Neon (10 min)

1. Sign up at neon.tech (free tier, no card) → create project `gamenight`, region **Singapore** (closest to Pakistan of the typical free regions — lower RTT for every DB query; geography is latency).
2. Copy the **connection string** (the pooled one is fine) — it looks like `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. This string is a **secret** (it contains the password). It goes in Render's env vars in Step 5 — never in git. The `.gitignore` already excludes `.env` for local use.

## Step 5 — Render (15 min)

1. Sign up at render.com (free), connect your GitHub.
2. **New → Blueprint** → select your `gamenight` repo. Render reads `infra/render.yaml` and proposes the `gamenight` free web service — accept.
3. When prompted for `DATABASE_URL`, paste the Neon string.
4. First deploy takes a few minutes (image build). Then visit `https://gamenight-xxxx.onrender.com`:
   - `/healthz` → `ok`
   - `/healthz/db` → `ok` with an `rtt_ms` (your Render instance ↔ Neon round-trip — compare it to your local ping to the same region and reason about why they differ)
   - `/` → the GameNight page, now on the public internet with TLS you didn't have to configure.

## Step 6 — Prove the pipeline (5 min)

Edit `server/src/app.ts`: change the hello message to include your name. Commit to a branch, open a PR, watch CI, merge → watch Render auto-deploy → refresh `/api/v1/hello`. **That loop is your development workflow forever now.**

## Step 7 — UptimeRobot (5 min)

Free account → HTTP monitor on `https://<your-app>/healthz`, 5-minute interval, alert to your email. This is both your outage alarm and the keep-warm heartbeat (SDD §25).

## Step 8 — Rehearse the exit (10 min) ← most people skip this; don't

M0 requires one rehearsed teardown: in Render, **delete the service**, then re-create it from the Blueprint and re-paste `DATABASE_URL`. Time yourself. Notice what survived without you doing anything: your data (Neon is external), your code (GitHub), your config recipe (`render.yaml`). *That* is the portability strategy from ADR-0003 — not a document, a rehearsed muscle.

---

## M0 checklist

- [ ] Local `npm run dev` serves all endpoints
- [ ] (Optional) compose runs with `healthz/db = ok` locally
- [ ] CI green on GitHub
- [ ] Live URL on Render, `/healthz/db = ok` against Neon
- [ ] One PR merged and auto-deployed (Step 6)
- [ ] UptimeRobot monitoring `/healthz`
- [ ] Teardown/redeploy rehearsed, time recorded in `docs/runbook.md`

When every box is ticked, Phase 0 is done. **Phase 1 (Identity):** Google OAuth from a real Google Cloud project, sessions, the `users` table with Drizzle migrations, the approval workflow, and the admin panel — where the OIDC theory from SDD §15 becomes running code.
