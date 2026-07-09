/**
 * Entry point: load config, wire dependencies, listen, shut down cleanly.
 */
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { buildApp } from './app.js';

const config = loadConfig();
const db = createDb(config);
const app = buildApp(config, db);

await app.listen({ port: config.port, host: config.host });

// Graceful shutdown: finish in-flight requests, release DB connections, exit 0.
// Render (and Docker) send SIGTERM before killing a container; ignoring it means
// dropped requests on every deploy. Handling it is table stakes, not polish.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await db?.close();
    process.exit(0);
  });
}
