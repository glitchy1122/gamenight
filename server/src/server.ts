import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { buildApp } from './app.js';
import { purgeExpired } from './modules/auth/sessions.js';
import { PresenceRegistry } from './modules/presence/registry.js';
import { attachGateway } from './ws/gateway.js';
import { startReminderScheduler } from './modules/notify/scheduler.js';

const config = loadConfig();
const db = createDb(config);

if (db) {
  await db.migrate();
  await purgeExpired(db);
}

const presence = new PresenceRegistry();
const app = buildApp(config, db);

// The gateway attaches to the raw Node HTTP server underneath Fastify:
// WebSocket upgrades happen below the framework, at the HTTP layer itself.
let gateway:
  | {
      close: () => void;
      sendToast: (userId: string, title: string, body: string) => boolean;
      broadcastToast: (title: string, body: string) => void;
    }
  | undefined;
let scheduler: { stop: () => void } | undefined;
if (db) {
  await app.ready();
  gateway = attachGateway({ httpServer: app.server, db, log: app.log, presence });
  scheduler = startReminderScheduler({ db, sendToast: gateway.sendToast });
}

await app.listen({ port: config.port, host: config.host });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    scheduler?.stop();
    gateway?.close();
    await app.close();
    await db?.close();
    process.exit(0);
  });
}
