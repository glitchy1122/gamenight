# Phase 5 Guide (part 1) — Onboarding Page & "Check My Setup" Diagnostics

**Goal:** make onboarding self-service before you invite ~20 friends. A "Get
playing in 3 steps" Setup page (game → Radmin → agent) and a "Check my setup"
button that runs read-only diagnostics on the user's own PC, each red result
carrying a plain-language fix.

Built & integration-tested: the agent diagnostics engine (Radmin connected?
peers reachable over the tunnel? FC2 found? agent version?), the dashboard→
server→agent→dashboard relay, the env-driven Setup page, and a fast-fail when no
agent is connected.

---

## Step 1 — Bring the code in
Extract over your repo (main is now correct & complete after the Phase 4 fix):
```powershell
cd "C:\Users\Sudo\Documents\NETWORKING PROJECT\gamenight"
git checkout main; git pull
git checkout -b feat/phase5-onboarding
git add .
git status                 # VERIFY: agent Diagnostics.cs, setup module, Setup.tsx, protocol/gateway/config/app/presence/api/App changes
git commit -m "feat: phase 5 - onboarding page and check-my-setup diagnostics"
git push -u origin feat/phase5-onboarding
git show --stat HEAD       # CONFIRM the commit contains everything (lesson from phase 4!)
```

## Step 2 — Set the two new env vars (Render + local)
On Render (Environment tab) and in your local dev-env.ps1:
- `GAME_DOWNLOAD_URL` = your Google Drive link to the FC2 package
- `RADMIN_NETWORK` = your Radmin network name (what friends type to join)
Without these the Setup page still works — it just shows "ask the admin" where a
link would be. (Graceful degradation.)

## Step 3 — Test locally
```powershell
. .\dev-env.ps1
npm run build
npm run dev -w server
```
- New **Setup** nav link → the 3-step page with your game/Radmin/agent links.
- Rebuild the agent (it has the diagnostics engine now):
  ```powershell
  cd agent; dotnet publish -c Release
  taskkill /IM GameNightAgent.exe /F 2>$null
  Copy-Item bin\Release\net8.0-windows\win-x64\publish\GameNightAgent.exe C:\GameNight\ -Force
  C:\GameNight\GameNightAgent.exe
  ```
- On the Setup page, click **Run diagnostics** → within a second you get a
  checklist: Radmin (should pass, showing your 26.x IP), peers (warn if nobody
  else online), FC2 (pass/warn), agent version. Try it with Radmin disconnected
  to see the red result + fix.

## Step 4 — Ship
Merge (CI green) → Render deploys. Publish agent **v0.5.0** to GitHub Releases
and update the AGENT_* env vars, so friends get the diagnostics-capable build.

## Checklist
- [ ] CI green; merged; deployed; agent v0.5.0 released
- [ ] Setup page shows 3 steps with working links
- [ ] Run diagnostics → checklist with statuses + fixes
- [ ] Red result (e.g. Radmin off) shows a plain-language fix
- [ ] No-agent case shows "start your agent"

## What's left in Phase 5
- ~~**Agent self-update** (the two-process binary-swap)~~ — done; see ADR-0009.
- **Onboard all ~20 friends** — you + community over the coming weeks.
- Housekeeping: ~~remove/trim agent debug logs~~ (24h retention in v0.7.1),
  a quick `npm audit` review, tray-icon polish.
