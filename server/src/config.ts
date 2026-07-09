/**
 * All environment access lives HERE and nowhere else.
 * Teaching note (12-factor app, factor III): config comes from the environment,
 * never from code. Centralizing it means one glance shows everything the app
 * needs to run, and no module can sneak a hidden env dependency.
 */
export type Config = {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  /** Optional in Phase 0 — the app must boot without a DB so /healthz works pre-Neon. */
  databaseUrl: string | undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv =
    env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
  return {
    // Render injects PORT; 8080 is our local default.
    port: env.PORT ? Number(env.PORT) : 8080,
    // 0.0.0.0 = listen on ALL interfaces. Inside a container this is required:
    // 127.0.0.1 would only accept connections from inside the container itself,
    // and Render's proxy could never reach us. (CCNA tie-in: binding address vs
    // routing — a socket bound to loopback is unreachable from any other host
    // by definition, no firewall involved.)
    host: env.HOST ?? '0.0.0.0',
    nodeEnv,
    databaseUrl: env.DATABASE_URL,
  };
}
