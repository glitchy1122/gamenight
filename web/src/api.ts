/** Tiny typed fetch layer. Cookies ride automatically (same origin). */
export type Me = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string;
  status: "pending" | "approved" | "rejected" | "banned";
  role: "admin" | "member";
  createdAt: string;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type RsvpEntry = {
  userId: string;
  name: string | null;
  response: string;
};
export type Match = {
  id: string;
  title: string;
  scheduledAt: string;
  slots: number | null;
  notes: string | null;
  status: "planned" | "live" | "done" | "cancelled";
  createdBy: string;
  createdAt: string;
  rsvps: RsvpEntry[];
};

export const api = {
  me: () => fetch("/api/v1/me").then((r) => json<{ user: Me | null }>(r)),
  users: () => fetch("/api/v1/users").then((r) => json<{ users: Me[] }>(r)),
  setStatus: (id: string, action: "approve" | "reject" | "ban") =>
    fetch(`/api/v1/users/${id}/${action}`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),
  logout: () =>
    fetch("/auth/logout", { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),
  matches: (upcoming = true) =>
    fetch(`/api/v1/matches${upcoming ? "?upcoming=1" : ""}`).then((r) =>
      json<{ matches: Match[] }>(r),
    ),
  createMatch: (body: {
    title: string;
    scheduledAt: string;
    slots?: number;
    notes?: string;
  }) =>
    fetch("/api/v1/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<{ match: Match }>(r)),
  rsvp: (id: string, response: "in" | "out" | "maybe") =>
    fetch(`/api/v1/matches/${id}/rsvp`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response }),
    }).then((r) => json<{ ok: true }>(r)),
  cancelMatch: (id: string) =>
    fetch(`/api/v1/matches/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }).then((r) => json<{ ok: true }>(r)),
  shareText: (id: string) =>
    fetch(`/api/v1/matches/${id}/share-text`).then((r) =>
      json<{ text: string; waUrl: string }>(r),
    ),
  setup: () =>
    fetch("/api/v1/setup").then((r) =>
      json<{
        gameUrl: string | null;
        radminNetwork: string | null;
        agent: {
          version: string | null;
          url: string | null;
          sha256: string | null;
        };
      }>(r),
    ),
  warriors: () =>
    fetch("/api/v1/warriors").then((r) =>
      json<{
        warriors: { name: string; title: string | null; imageUrl: string }[];
      }>(r),
    ),
};
