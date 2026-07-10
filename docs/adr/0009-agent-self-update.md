# ADR-0009: Agent self-update via two-process binary-swap

## Status
Accepted

## Context
Shipping an agent fix meant every friend re-downloaded `GameNightAgent.exe` by
hand. The server already exposes `GET /api/v1/agent/latest` with
`{ version, url, sha256 }` pointing at a GitHub Release asset (see
`releases/routes.ts`). The missing piece was the agent consuming that metadata.

Windows locks a running executable, so an in-process overwrite is impossible.
A separate updater binary would double the release surface. Friends also run the
agent from user-writable folders (not Program Files), so an in-place replace is
viable without elevation.

## Decision
The agent self-updates with a **two-process binary-swap**:

1. Poll `GET /api/v1/agent/latest` (startup + every 6h, and tray "Check for updates").
2. If `version` > local `AgentInfo.Version` and `url`/`sha256` are set, download
   to `%LOCALAPPDATA%\GameNight\update\GameNightAgent.pending.exe`.
3. Verify SHA-256; on mismatch delete the file and abort (fail closed).
4. Copy pending → `GameNightAgent.swap.exe`, launch swap with
   `--apply-update <pending> <ProcessPath> <pid>`, then exit the main process
   (releases the file lock and the single-instance mutex).
5. The swap child waits for the parent PID, replaces the target exe, relaunches
   it, and exits.

`--apply-update` is handled in `Program.Main` **before** the mutex so the child
is never blocked by the still-running parent.

Auto-update is silent when already current; failures and successful swaps show a
tray balloon. Diagnostics compares local vs latest and warns when behind.

## Consequences
- Publishing a new agent = GitHub Release + update the three `AGENT_*` env vars
  on Render. Existing agents pick it up within ~6h (or immediately via the tray).
- The install directory must be writable by the user. Program Files installs
  will fail the replace step (toast + `update.log`); document "run from a
  user folder" in the release notes.
- SHA-256 is mandatory for auto-update. If `AGENT_SHA256` is unset, the agent
  treats metadata as not configured and does not download.
- No code signing yet — SmartScreen warnings remain a separate concern.
