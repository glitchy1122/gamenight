# Phase 4 Guide — Scheduling, WhatsApp Share, Toast Notifications

**Goal (Milestone M4):** create a game night on the site, members RSVP, one tap
shares it to WhatsApp, and RSVP'd players get a Windows toast 30 min before —
plus a "someone started FC2" nudge when a session spontaneously begins.

Built & integration-tested: matches + RSVP schema (migration 0002), match CRUD
with creator/admin permissions, idempotent RSVP (composite-PK upsert), the
wa.me share-text endpoint, a server-side 30-min reminder scheduler, "started
hosting" toast broadcast, the agent's toast receiver (native Windows balloon),
a full Matches page (create/RSVP/cancel/share), and a "next match" card on Home.

---

## Step 1 — Bring the code in (10 min)
Extract the zip over your repo, then:
```powershell
cd "C:\Users\Sudo\Documents\NETWORKING PROJECT\gamenight"
git checkout main; git pull
git checkout -b feat/phase4-scheduling
git add .; git status   # review: matches module, notify module, migration 0002, Matches.tsx, agent toast files, docs
git commit -m "feat: phase 4 - scheduling, whatsapp share, toast notifications"
git push -u origin feat/phase4-scheduling
```
Open PR; keep unmerged until local test passes. `npm install`.

## Step 2 — Test the web flow locally (10 min)
```powershell
. .\dev-env.ps1
npm run build
npm run dev -w server
```
At localhost:8080 → new **Matches** nav link. Create a match (title + date/time +
optional slots) → it appears with you auto-RSVP'd "in". Click **I'm in / Maybe /
Out** to change your RSVP. Click **Share to WhatsApp** → a WhatsApp tab opens with
a pre-filled message (pick any chat to see it; you don't have to send). The Home
page shows a blue **NEXT GAME NIGHT** card.

Migration 0002 runs at boot (creates `matches` + `rsvps` in Neon) — watch the
startup logs.

## Step 3 — Rebuild the agent for toasts (5 min)
The agent gained toast handling. Rebuild + redeploy (bump to v0.4.0 for the release):
```powershell
cd agent
dotnet publish -c Release
taskkill /IM GameNightAgent.exe /F 2>$null
Copy-Item bin\Release\net8.0-windows\win-x64\publish\GameNightAgent.exe C:\GameNight\ -Force
C:\GameNight\GameNightAgent.exe
```

## Step 4 — Test toasts (10 min)
Two ways to see a Windows balloon:
- **"Started hosting":** with a second agent online (friend or 2nd PC), launch
  Far Cry 2 on one — the OTHER machine gets a "X started Far Cry 2 — Jump in!"
  toast. (Needs 2 agents.)
- **Reminder:** create a match scheduled ~30 min out with yourself RSVP'd "in";
  within a minute the scheduler fires a "Match in N min" toast to your agent.
  (Tip to test fast: schedule it 29 minutes out so it's already inside the
  window — the reminder fires on the next minute tick.)

If Windows toasts don't appear, check Settings → System → Notifications is on and
Focus Assist isn't suppressing them.

## Step 5 — Ship it
Merge PR (CI green) → Render deploys. For the toast-capable agent, publish
**agent-v0.4.0** to GitHub Releases and update the 3 Render AGENT_* env vars, so
friends get the build that can show toasts.

## M4 checklist
- [ ] CI green; merged; deployed; agent v0.4.0 released
- [ ] Create match → appears with creator auto-in
- [ ] RSVP in/maybe/out updates the roster live
- [ ] Share to WhatsApp opens a pre-filled message
- [ ] Home shows the next-match card
- [ ] Reminder toast fires ~30 min before (or test with a near-term match)
- [ ] (2 agents) "started FC2" toast reaches the other player

Declare **"Phase 4 complete"** → Phase 5 (setup guide, diagnostics, agent
self-update, onboard everyone) is the final stretch.
