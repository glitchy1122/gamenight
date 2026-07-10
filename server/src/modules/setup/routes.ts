/** Setup/onboarding info (SDD §21, FR-50) — env-driven so links change without redeploy. */
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config.js';

export function registerSetupRoutes(app: FastifyInstance, config: Config) {
  app.get('/api/v1/setup', async () => ({
    gameUrl: config.setup.gameUrl,
    radminNetwork: config.setup.radminNetwork,
    agent: { version: config.agent.version, url: config.agent.url, sha256: config.agent.sha256 },
  }));
}
