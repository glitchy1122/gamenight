/**
 * Database access seam. Phase 0 only proves connectivity (SELECT 1);
 * Drizzle schema + migrations arrive in Phase 1 with the users table.
 */
import postgres from 'postgres';
import type { Config } from './config.js';

export type Db = {
  /** Round-trips the database. Throws if unreachable. */
  ping(): Promise<void>;
  close(): Promise<void>;
};

export function createDb(config: Config): Db | undefined {
  if (!config.databaseUrl) return undefined;

  // max 3 connections: Neon's free tier allows few; a 20-user app needs few.
  // Beginner mistake avoided: default pools of 10–20 per instance exhaust
  // small Postgres plans the moment you run two instances.
  const sql = postgres(config.databaseUrl, { max: 3, connect_timeout: 5 });

  return {
    async ping() {
      await sql`SELECT 1`;
    },
    async close() {
      await sql.end();
    },
  };
}
