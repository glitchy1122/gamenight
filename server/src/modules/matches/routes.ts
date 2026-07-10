/**
 * Match scheduling (SDD §10, FR-40..43). Ordinary transactional CRUD +
 * RSVPs — the "persistent, structured" data flow, distinct from ephemeral
 * presence. The WhatsApp share endpoint generates a pre-filled wa.me link:
 * one human tap announces to the group, no bot, no ban risk (ADR to follow).
 */
import type { FastifyInstance } from 'fastify';
import { and, eq, gte, desc, asc } from 'drizzle-orm';
import type { Config } from '../../config.js';
import type { Db } from '../../db.js';
import { matches, rsvps, users } from '../../db/schema.js';
import { requireApproved } from '../../plugins/auth.js';

type RsvpResponse = 'in' | 'out' | 'maybe';

export function registerMatchRoutes(app: FastifyInstance, db: Db | undefined, config: Config) {
  // List upcoming (or all) matches with their RSVP rosters.
  app.get<{ Querystring: { upcoming?: string } }>(
    '/api/v1/matches',
    { preHandler: requireApproved },
    async (req) => {
      if (!db) return { matches: [] };
      const onlyUpcoming = req.query.upcoming === '1';
      const rows = await db.orm
        .select()
        .from(matches)
        .where(onlyUpcoming ? gte(matches.scheduledAt, new Date()) : undefined)
        .orderBy(onlyUpcoming ? asc(matches.scheduledAt) : desc(matches.scheduledAt));

      // Fetch all rsvps + names in one pass, group in memory (small data).
      const allRsvps = await db.orm
        .select({
          matchId: rsvps.matchId,
          userId: rsvps.userId,
          response: rsvps.response,
          name: users.displayName,
        })
        .from(rsvps)
        .innerJoin(users, eq(rsvps.userId, users.id));

      const byMatch = new Map<
        string,
        { userId: string; name: string | null; response: string }[]
      >();
      for (const r of allRsvps) {
        const arr = byMatch.get(r.matchId) ?? [];
        arr.push({ userId: r.userId, name: r.name, response: r.response });
        byMatch.set(r.matchId, arr);
      }

      return {
        matches: rows.map((m) => ({ ...m, rsvps: byMatch.get(m.id) ?? [] })),
      };
    },
  );

  app.post<{ Body: { title?: string; scheduledAt?: string; slots?: number; notes?: string } }>(
    '/api/v1/matches',
    { preHandler: requireApproved },
    async (req, reply) => {
      if (!db) return reply.code(503).send({ error: 'no database' });
      const { title, scheduledAt, slots, notes } = req.body ?? {};
      if (!title || !scheduledAt)
        return reply.code(400).send({ error: 'title and scheduledAt required' });
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime()))
        return reply.code(400).send({ error: 'invalid scheduledAt' });

      const inserted = await db.orm
        .insert(matches)
        .values({
          title: title.slice(0, 120),
          scheduledAt: when,
          slots: typeof slots === 'number' && slots > 0 ? slots : null,
          notes: notes?.slice(0, 500) ?? null,
          createdBy: req.user!.id,
        })
        .returning();
      // Creator is auto-RSVP'd "in" — they proposed it, they're playing.
      await db.orm
        .insert(rsvps)
        .values({ matchId: inserted[0]!.id, userId: req.user!.id, response: 'in' });
      return { match: inserted[0] };
    },
  );

  // Edit / cancel — creator or admin only (SDD §16).
  app.patch<{ Params: { id: string }; Body: { status?: string; title?: string; notes?: string } }>(
    '/api/v1/matches/:id',
    { preHandler: requireApproved },
    async (req, reply) => {
      if (!db) return reply.code(503).send({ error: 'no database' });
      const existing = await db.orm
        .select()
        .from(matches)
        .where(eq(matches.id, req.params.id))
        .limit(1);
      const m = existing[0];
      if (!m) return reply.code(404).send({ error: 'not found' });
      if (m.createdBy !== req.user!.id && req.user!.role !== 'admin')
        return reply.code(403).send({ error: 'only the creator or an admin can edit' });

      const patch: Partial<typeof matches.$inferInsert> = {};
      if (req.body.status && ['planned', 'live', 'done', 'cancelled'].includes(req.body.status))
        patch.status = req.body.status as 'planned' | 'live' | 'done' | 'cancelled';
      if (typeof req.body.title === 'string') patch.title = req.body.title.slice(0, 120);
      if (typeof req.body.notes === 'string') patch.notes = req.body.notes.slice(0, 500);
      await db.orm.update(matches).set(patch).where(eq(matches.id, req.params.id));
      return { ok: true };
    },
  );

  // RSVP — idempotent upsert (PUT): one response per user per match.
  app.put<{ Params: { id: string }; Body: { response?: RsvpResponse } }>(
    '/api/v1/matches/:id/rsvp',
    { preHandler: requireApproved },
    async (req, reply) => {
      if (!db) return reply.code(503).send({ error: 'no database' });
      const response = req.body?.response;
      if (!response || !['in', 'out', 'maybe'].includes(response))
        return reply.code(400).send({ error: 'response must be in|out|maybe' });
      // Upsert on the composite PK — the DB enforces uniqueness, we just
      // update-or-insert. onConflictDoUpdate is Postgres' UPSERT.
      await db.orm
        .insert(rsvps)
        .values({ matchId: req.params.id, userId: req.user!.id, response })
        .onConflictDoUpdate({
          target: [rsvps.matchId, rsvps.userId],
          set: { response, updatedAt: new Date() },
        });
      return { ok: true };
    },
  );

  // WhatsApp share text (FR-42): returns a formatted message + a wa.me URL.
  // The wa.me link opens WhatsApp with the text pre-filled; the human picks
  // the group and hits send. Fully allowed, zero ban risk (ADR-0007).
  app.get<{ Params: { id: string } }>(
    '/api/v1/matches/:id/share-text',
    { preHandler: requireApproved },
    async (req, reply) => {
      if (!db) return reply.code(503).send({ error: 'no database' });
      const rows = await db.orm
        .select()
        .from(matches)
        .where(eq(matches.id, req.params.id))
        .limit(1);
      const m = rows[0];
      if (!m) return reply.code(404).send({ error: 'not found' });

      const inCount = (
        await db.orm
          .select({ n: rsvps.userId })
          .from(rsvps)
          .where(and(eq(rsvps.matchId, m.id), eq(rsvps.response, 'in')))
      ).length;
      const slotsLeft = m.slots ? Math.max(0, m.slots - inCount) : null;
      const when = new Date(m.scheduledAt);
      const whenStr = when.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      const link = `${config.appUrl}/matches`;
      const text =
        `🎮 ${m.title}\n${whenStr}\n` +
        (slotsLeft !== null ? `${slotsLeft} slot(s) left · ` : '') +
        `${inCount} in\nRSVP: ${link}`;
      return { text, waUrl: `https://wa.me/?text=${encodeURIComponent(text)}` };
    },
  );
}
