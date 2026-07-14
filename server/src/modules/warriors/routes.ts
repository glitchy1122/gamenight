/**
 * The Squad — a wall of warrior portraits (ADR-0011). Zero-code to add a mate:
 * drop an image into the repo's warriors/ folder (via GitHub's web UI, no git
 * needed) and it appears on the dashboard within the cache window.
 *
 * Source: the GitHub Contents API lists warriors/ (images) and, if present,
 * warriors.json (optional names + titles). Same resilience pattern as the
 * release endpoint — 60-min cache, serve-stale-on-failure, honest empty on cold
 * failure — so we stay well under GitHub's unauthenticated rate limit.
 */
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config.js';

export type Warrior = { name: string; title: string | null; imageUrl: string };

const CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

let cached: Warrior[] | null = null;
let cachedAt = 0;
let inFlight: Promise<Warrior[] | null> | null = null;

type GhContentItem = { name: string; type: string; download_url: string | null };
type MetaEntry = { file?: string; name?: string; title?: string };

// filename → display name fallback: "waqar_ahmed.png" → "Waqar Ahmed"
function nameFromFile(file: string): string {
  return file
    .replace(IMAGE_RE, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'gamenight-server' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return (await res.json()) as T;
}

async function fetchWarriorsFromGitHub(config: Config): Promise<Warrior[]> {
  const { owner, repo } = config.github;
  const base = `https://api.github.com/repos/${owner}/${repo}/contents`;

  // 1. List the warriors/ folder.
  let items: GhContentItem[];
  try {
    items = await ghJson<GhContentItem[]>(`${base}/warriors`);
  } catch {
    return []; // folder doesn't exist yet — empty wall, not an error
  }

  // 2. Optional metadata (names/titles). Absent → filenames become names.
  const meta = new Map<string, MetaEntry>();
  const metaItem = items.find((i) => i.name.toLowerCase() === 'warriors.json');
  if (metaItem?.download_url) {
    try {
      const raw = await fetch(metaItem.download_url, {
        headers: { 'User-Agent': 'gamenight-server' },
        signal: AbortSignal.timeout(8000),
      });
      if (raw.ok) {
        const entries = (await raw.json()) as MetaEntry[];
        for (const e of entries) if (e.file) meta.set(e.file.toLowerCase(), e);
      }
    } catch {
      /* bad/absent json → just skip metadata */
    }
  }

  // 3. Build the warrior list from image files, merging metadata by filename.
  const warriors: Warrior[] = [];
  for (const item of items) {
    if (item.type !== 'file' || !IMAGE_RE.test(item.name) || !item.download_url) continue;
    const m = meta.get(item.name.toLowerCase());
    warriors.push({
      name: m?.name ?? nameFromFile(item.name),
      title: m?.title ?? null,
      imageUrl: item.download_url,
    });
  }

  // Stable, friendly order: by name.
  warriors.sort((a, b) => a.name.localeCompare(b.name));
  return warriors;
}

async function getWarriors(config: Config, log: FastifyInstance['log']): Promise<Warrior[] | null> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const list = await fetchWarriorsFromGitHub(config);
        cached = list;
        cachedAt = Date.now();
        return list;
      } catch (err) {
        log.warn({ err: String(err) }, 'warriors: GitHub refresh failed');
        return cached; // stale-on-failure (or null if cold)
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}

export function registerWarriorRoutes(app: FastifyInstance, config: Config) {
  app.get('/api/v1/warriors', async () => {
    const list = await getWarriors(config, app.log);
    return { warriors: list ?? [] };
  });
}
