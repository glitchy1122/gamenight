import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Match, type Me } from "../api";

function whenStr(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Matches({ me }: { me: Me }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["matches"],
    queryFn: () => api.matches(true),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["matches"] });

  return (
    <>
      <h1>Game nights</h1>
      <CreateMatch onCreated={invalidate} />
      {(q.data?.matches ?? []).length === 0 && (
        <p className="muted">No upcoming matches. Schedule one above!</p>
      )}
      {(q.data?.matches ?? []).map((m) => (
        <MatchCard key={m.id} match={m} me={me} onChange={invalidate} />
      ))}
    </>
  );
}

function CreateMatch({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [slots, setSlots] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api.createMatch({
        title,
        scheduledAt: new Date(when).toISOString(),
        slots: slots ? Number(slots) : undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setWhen("");
      setSlots("");
      onCreated();
    },
  });
  const valid = title.trim() && when;
  return (
    <div className="card">
      <strong>Schedule a match</strong>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: ".5rem",
          marginTop: ".6rem",
        }}
      >
        <input
          placeholder="e.g. FC2 Friday night"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            flex: "2 1 200px",
            padding: ".5rem",
            borderRadius: 6,
            border: "1px solid #232c42",
            background: "#0f1420",
            color: "#e6e9f0",
          }}
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          style={{
            flex: "1 1 160px",
            padding: ".5rem",
            borderRadius: 6,
            border: "1px solid #232c42",
            background: "#0f1420",
            color: "#e6e9f0",
          }}
        />
        <input
          type="number"
          placeholder="slots"
          value={slots}
          onChange={(e) => setSlots(e.target.value)}
          style={{
            width: 80,
            padding: ".5rem",
            borderRadius: 6,
            border: "1px solid #232c42",
            background: "#0f1420",
            color: "#e6e9f0",
          }}
        />
        <button
          className="btn"
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "…" : "Create"}
        </button>
      </div>
    </div>
  );
}

function MatchCard({
  match: m,
  me,
  onChange,
}: {
  match: Match;
  me: Me;
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const rsvp = useMutation({
    mutationFn: (r: "in" | "out" | "maybe") => api.rsvp(m.id, r),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelMatch(m.id),
    onSuccess: onChange,
  });
  const [share, setShare] = useState<string | null>(null);

  const ins = m.rsvps.filter((r) => r.response === "in");
  const maybes = m.rsvps.filter((r) => r.response === "maybe");
  const mine = m.rsvps.find((r) => r.userId === me.id)?.response;
  const canManage = m.createdBy === me.id || me.role === "admin";
  const cancelled = m.status === "cancelled";

  const doShare = async () => {
    const { waUrl } = await api.shareText(m.id);
    window.open(waUrl, "_blank");
    setShare("opened");
  };

  return (
    <div className="card" style={{ opacity: cancelled ? 0.55 : 1 }}>
      <div className="row">
        <div className="grow">
          <strong style={{ fontSize: "1.1rem" }}>
            {m.title}{" "}
            {cancelled && <span className="tag rejected">cancelled</span>}
          </strong>
          <div className="muted">{whenStr(m.scheduledAt)}</div>
        </div>
        {canManage && !cancelled && (
          <button className="btn danger" onClick={() => cancel.mutate()}>
            Cancel
          </button>
        )}
      </div>

      <div style={{ margin: ".6rem 0" }}>
        <span className="muted">
          {ins.length} in{m.slots ? ` / ${m.slots}` : ""}
          {maybes.length > 0 && ` · ${maybes.length} maybe`}
        </span>
        <div style={{ fontSize: ".9rem", marginTop: ".2rem" }}>
          {ins.map((r) => r.name).join(", ") || (
            <span className="muted">nobody yet</span>
          )}
        </div>
      </div>

      {!cancelled && (
        <div className="row" style={{ gap: ".4rem" }}>
          {(["in", "maybe", "out"] as const).map((r) => (
            <button
              key={r}
              className={`btn ${mine === r ? "" : "secondary"}`}
              onClick={() => rsvp.mutate(r)}
            >
              {r === "in" ? "I'm in" : r === "maybe" ? "Maybe" : "Out"}
            </button>
          ))}
          <span className="grow" />
          <button className="btn secondary" onClick={doShare}>
            📤 Share to WhatsApp
          </button>
        </div>
      )}
      {share && (
        <p className="muted" style={{ fontSize: ".8rem" }}>
          WhatsApp opened — pick your group and send.
        </p>
      )}
    </div>
  );
}
