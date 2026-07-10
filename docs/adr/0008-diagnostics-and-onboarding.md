# ADR-0008: Agent-run diagnostics + env-driven onboarding page

**Status:** accepted · **Date:** 2026-07-10

## Context
Before onboarding ~20 non-technical friends, we need to cut the support burden:
newcomers must be able to get set up and self-diagnose without messaging the
admin at 11pm (SDD §21, FR-50..53).

## Decisions
- **Diagnostics run in the agent, not the server.** Only the agent can see the
  local machine — Radmin adapter state, peer reachability over the tunnel, the
  FC2 install. The dashboard sends "run_diagnostics" → server relays "diagnose"
  to that user's OWN agent → agent runs read-only checks → results flow back to
  the dashboard. You can only diagnose your own setup (relayed by userId).
- **Every check ships a plain-language fix**, not just a red/green. "Radmin not
  connected → Open Radmin VPN and click Connect." The fix is the point.
- **Fast-fail when no agent is connected** — the dashboard gets an immediate
  "start your agent" result instead of hanging.
- **Onboarding page is env-driven** (GAME_DOWNLOAD_URL, RADMIN_NETWORK, reusing
  AGENT_DOWNLOAD_URL). The admin updates links without a redeploy; the "3 steps"
  page adapts to whatever's configured and degrades gracefully when it isn't.
- **Checks stay privacy-preserving** — same read-only pledge as the rest of the
  agent. Radmin state, ping reachability, best-effort FC2 path; nothing else.

## Consequences
Self-service onboarding + troubleshooting, which is what makes a 20-person
rollout survivable. Diagnostics are on-demand (not continuous) — no background
cost. Verified by an integration test covering both the no-agent and
agent-connected relay paths.
