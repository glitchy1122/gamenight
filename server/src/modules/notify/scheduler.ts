/**
 * Match reminder scheduler (SDD §10, FR-43). A single server-side loop wakes
 * every minute, finds matches starting in ~30 minutes that haven't been
 * reminded yet, and toasts every user who RSVP'd "in". Server-timestamped —
 * we never trust client clocks for scheduling (SDD §20 clock discipline).
 *
 * Idempotency: a match is reminded at most once. We track reminded IDs in
 * memory; on restart the worst case is a duplicate reminder or a missed one
 * for a match firing in the exact restart window — acceptable for game night.
 */
import { and, gte, lte, eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { matches, rsvps, users } from '../../db/schema.js';

const REMINDER_LEAD_MS = 30 * 60 * 1000; // 30 minutes before
const CHECK_INTERVAL_MS = 60 * 1000; // wake every minute

export function startReminderScheduler(opts: {
  db: Db;
  sendToast: (userId: string, title: string, body: string) => boolean;
}) {
  const { db, sendToast } = opts;
  const reminded = new Set<string>();

  const tick = async () => {
    const now = Date.now();
    // matches starting between now and now+30min, still planned
    const windowEnd = new Date(now + REMINDER_LEAD_MS);
    const due = await db.orm
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.status, 'planned'),
          gte(matches.scheduledAt, new Date(now)),
          lte(matches.scheduledAt, windowEnd),
        ),
      );

    for (const m of due) {
      if (reminded.has(m.id)) continue;
      reminded.add(m.id);
      const minutesAway = Math.round((new Date(m.scheduledAt).getTime() - now) / 60000);
      // everyone who said "in"
      const attendees = await db.orm
        .select({ userId: rsvps.userId })
        .from(rsvps)
        .innerJoin(users, eq(rsvps.userId, users.id))
        .where(and(eq(rsvps.matchId, m.id), eq(rsvps.response, 'in')));
      for (const a of attendees) {
        sendToast(a.userId, `Match in ${minutesAway} min`, m.title);
      }
    }
  };

  const timer = setInterval(() => void tick().catch(() => {}), CHECK_INTERVAL_MS);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
