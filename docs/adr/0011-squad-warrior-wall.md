# ADR-0011: The Squad — GitHub-folder-sourced warrior wall

**Status:** accepted · **Date:** 2026-07-14

## Context
Wanted a fun "wall of warriors" on the dashboard showing AI-generated portraits
of the crew, addable by non-developers without code changes or redeploys.

## Decision
Images live in a `warriors/` folder in the repo. The server lists that folder
via the GitHub Contents API and serves the image URLs + optional names/titles
(from an optional `warriors.json`) to the dashboard. Adding a warrior = upload an
image to the folder via GitHub's web UI (drag-drop, no git). Reuses the release
endpoint's resilience pattern: 60-min cache, serve-stale-on-failure, empty on
cold failure — well under GitHub's 60/hr unauthenticated limit.

Display: a responsive wall of large square cards (1024×1024 portraits recommended
for native AI-tool output), lazy-loaded, with hover zoom and a name/title
overlay. The current recommended host's card gets a gold 🏆 glow, matched by
name — tying the decorative wall to the live mesh data.

## Consequences
Zero-code warrior management. `warriors.json` is optional (filenames become names
otherwise). No new env vars — reuses GITHUB_OWNER/GITHUB_REPO. The wall hides
itself entirely when the folder is empty, so it's harmless before images exist.
