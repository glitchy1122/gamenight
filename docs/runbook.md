# Runbook

## Publish a new agent build
1. Bump `<Version>` in `agent/GameNight.Agent.csproj` **and** `AgentInfo.Version` in `agent/src/Dto.cs` (keep them identical).
2. Build:
   ```powershell
   cd agent
   dotnet publish -c Release
   ```
   Output: `agent\bin\Release\net8.0-windows\win-x64\publish\GameNightAgent.exe`
3. SHA-256 (PowerShell):
   ```powershell
   (Get-FileHash .\bin\Release\net8.0-windows\win-x64\publish\GameNightAgent.exe -Algorithm SHA256).Hash.ToLower()
   ```
4. Create a GitHub Release tagged `agent-vX.Y.Z`, upload the exe as an asset, copy the asset's direct download URL.
5. On Render → Environment, set:
   - `AGENT_VERSION` = `X.Y.Z`
   - `AGENT_DOWNLOAD_URL` = the release asset URL
   - `AGENT_SHA256` = the lowercase hex from step 3
6. Save (redeploy). Existing agents poll `/api/v1/agent/latest` within ~6 hours (or tray → **Check for updates**) and self-swap after verifying the hash. See ADR-0009.

## Deploy
Push to `main` → CI green → Render auto-deploys from the Blueprint. Rollback: Render dashboard → previous deploy → "Rollback".

## Secrets
### Rotating GOOGLE_CLIENT_SECRET
Do this if the secret ever leaks (pasted somewhere public, committed, laptop stolen) or annually as hygiene.
1. console.cloud.google.com → APIs & Services → Credentials → OAuth client `gamenight-web`.
2. Under "Client secrets": **Add secret** → copy the new value. (Old one keeps working — no downtime yet.)
3. Render → gamenight service → Environment → update `GOOGLE_CLIENT_SECRET` → Save (auto-redeploys).
4. Verify: sign out and sign in on the live URL.
5. Back in Google Console: **delete the old secret**. Now the leaked one is dead.
Note: client_id is NOT secret (it's visible in the login redirect URL) — only the secret rotates.
Existing user sessions survive rotation — the secret is only used during the login handshake.

## Restore drill (quarterly, SDD §29)
TBD Phase 1 when the first real table exists: restore latest `pg_dump` artifact into a scratch Neon branch, run smoke queries, record time taken.

## Known operational facts
- Free instance sleeps after ~15 min idle; first request pays 30–60 s.
- `/healthz` = liveness (UptimeRobot target). `/healthz/db` = readiness.
