import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

/**
 * The Squad — a wall of AI warrior portraits. `championName` (the current
 * recommended host, matched by name) gets a gold glow, tying the wall to the
 * live mesh. Images lazy-load so 20 large portraits don't slow the page.
 */
export function Squad({ championName }: { championName?: string | null }) {
  const q = useQuery({
    queryKey: ["warriors"],
    queryFn: api.warriors,
    staleTime: 5 * 60 * 1000,
  });
  const warriors = q.data?.warriors ?? [];
  if (warriors.length === 0) return null; // nothing to show until images are added

  return (
    <div style={{ marginTop: "2.5rem" }}>
      <h2
        style={{
          fontSize: "1.5rem",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          background: "linear-gradient(90deg,#e6a53a,#f0d078,#e6a53a)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: ".3rem",
        }}
      >
        ⚔️ The Squad
      </h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1.2rem" }}>
        The warriors of GameNight.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1.1rem",
        }}
      >
        {warriors.map((w, i) => {
          const isChampion =
            championName != null &&
            w.name.toLowerCase().trim() === championName.toLowerCase().trim();
          return (
            <WarriorCard
              key={w.name + i}
              warrior={w}
              champion={isChampion}
              index={i}
            />
          );
        })}
      </div>
    </div>
  );
}

function WarriorCard({
  warrior,
  champion,
  index,
}: {
  warrior: { name: string; title: string | null; imageUrl: string };
  champion: boolean;
  index: number;
}) {
  return (
    <div
      className="warrior-card"
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "default",
        border: champion ? "2px solid #f0d078" : "1px solid #232c42",
        boxShadow: champion
          ? "0 0 0 2px rgba(240,208,120,.25), 0 0 28px rgba(240,208,120,.35)"
          : "0 6px 20px rgba(0,0,0,.35)",
        animation: `warriorIn .5s ease ${index * 0.05}s both`,
      }}
    >
      <img
        src={warrior.imageUrl}
        alt={warrior.name}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          transition: "transform .35s ease",
        }}
      />

      {champion && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(240,208,120,.92)",
            color: "#1a1400",
            fontSize: ".7rem",
            fontWeight: 800,
            letterSpacing: ".05em",
            padding: "3px 8px",
            borderRadius: 20,
          }}
        >
          🏆 HOST
        </div>
      )}

      {/* name/title overlay — always shows a gradient footer, richer on hover */}
      <div
        className="warrior-overlay"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "1.6rem .9rem .8rem",
          background:
            "linear-gradient(to top, rgba(6,9,16,.92), rgba(6,9,16,0))",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff" }}>
          {warrior.name}
        </div>
        {warrior.title && (
          <div
            style={{
              fontSize: ".82rem",
              color: "#f0d078",
              fontStyle: "italic",
            }}
          >
            {warrior.title}
          </div>
        )}
      </div>

      <style>{`
        @keyframes warriorIn {
          from { opacity: 0; transform: translateY(14px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .warrior-card:hover img { transform: scale(1.06); }
      `}</style>
    </div>
  );
}
