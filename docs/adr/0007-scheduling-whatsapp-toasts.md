# ADR-0007: Scheduling with WhatsApp share links + agent toasts

**Status:** accepted · **Date:** 2026-07-10

## Context
Pain point #3 from discovery: coordination scattered across WhatsApp. Need
structured scheduling (who's in, when) without fighting WhatsApp at chatting,
and time-critical reminders (SDD §10, FR-40..44).

## Decisions
- **Matches + RSVPs are ordinary transactional Postgres data.** RSVP uses a
  composite PK (match_id, user_id) so "one response per user" is a DB
  constraint, not app logic; PUT upsert (onConflictDoUpdate) makes RSVP
  idempotent. This is the "persistent, structured" flow, distinct from
  ephemeral presence.
- **WhatsApp via wa.me share links, NOT a bot.** The server returns pre-filled
  message text + a wa.me URL; one human tap opens WhatsApp with it ready, the
  human picks the group and sends. Fully allowed, zero ban risk. Unofficial
  WhatsApp libraries (whatsapp-web.js/Baileys) were rejected: they get phone
  numbers banned and break on every WhatsApp update — never put a critical path
  on a service actively trying to stop you.
- **Toasts over the channel we own: the agent.** The agent already holds a
  WebSocket; the server pushes {t:'toast',title,body} and the agent shows a
  native Windows balloon. Free, unlimited, unbannable, and it reaches people at
  their PC — the exact moment they can act. Two triggers: a server-side
  scheduler (30-min-before reminders to RSVP'd-in users) and a "someone started
  Far Cry 2" broadcast on the in_game transition.

## Consequences
Announcements ride WhatsApp (borrowed, human-triggered, safe); time-critical
pings ride the agent (owned). Reminder scheduler tracks reminded IDs in memory
— a restart may duplicate/miss a reminder in the exact restart minute, fine for
game night. Verified: match CRUD, idempotent RSVP, share text, and cancel
permissions all integration-tested.
