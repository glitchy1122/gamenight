/**
 * Dashboard WebSocket client — one socket, all live data (presence + the
 * Phase 3 mesh matrix). Authenticates via the session cookie on the upgrade,
 * receives a presence snapshot then deltas, plus periodic matrix + host
 * recommendation. Reconnects with backoff — the same resilience pattern the
 * C# agent uses, in miniature.
 */
import { useEffect, useRef, useState } from "react";
import type {
  PresenceUser,
  MatrixCell,
  HostRecommendation,
  DiagCheck,
} from "../../server/src/protocol/messages";

export type LiveData = {
  presence: Map<string, PresenceUser>;
  matrix: MatrixCell[];
  recommendation: HostRecommendation;
  diagnostics: DiagCheck[] | null;
  runDiagnostics: () => void;
};

export function useLiveData(): LiveData {
  const [presence, setPresence] = useState<Map<string, PresenceUser>>(
    new Map(),
  );
  const [matrix, setMatrix] = useState<MatrixCell[]>([]);
  const [recommendation, setRecommendation] =
    useState<HostRecommendation>(null);
  const [diagnostics, setDiagnostics] = useState<DiagCheck[] | null>(null);
  const sockRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let sock: WebSocket | null = null;
    let closed = false;
    let attempt = 0;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      sock = new WebSocket(`${proto}://${location.host}/ws`);

      sock.onopen = () => {
        attempt = 0;
        sockRef.current = sock;
        sock?.send(JSON.stringify({ t: "hello", role: "dashboard" }));
      };

      sock.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as
          | { t: "presence"; users: PresenceUser[] }
          | { t: "presence_delta"; user: PresenceUser }
          | {
              t: "matrix";
              cells: MatrixCell[];
              recommendation: HostRecommendation;
            }
          | { t: "diagnostics_result"; userId: string; checks: DiagCheck[] };

        if (msg.t === "presence") {
          setPresence(new Map(msg.users.map((u) => [u.userId, u])));
        } else if (msg.t === "presence_delta") {
          setPresence((prev) => {
            const next = new Map(prev);
            if (msg.user.state === "offline") next.delete(msg.user.userId);
            else next.set(msg.user.userId, msg.user);
            return next;
          });
        } else if (msg.t === "matrix") {
          setMatrix(msg.cells);
          setRecommendation(msg.recommendation);
        } else if (msg.t === "diagnostics_result") {
          setDiagnostics(msg.checks);
        }
      };

      sock.onclose = () => {
        if (closed) return;
        const delay =
          Math.min(1000 * 2 ** attempt++, 30_000) * (0.8 + Math.random() * 0.4);
        setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closed = true;
      sock?.close();
    };
  }, []);

  const runDiagnostics = () => {
    setDiagnostics(null);
    sockRef.current?.send(JSON.stringify({ t: "run_diagnostics" }));
  };

  return { presence, matrix, recommendation, diagnostics, runDiagnostics };
}
