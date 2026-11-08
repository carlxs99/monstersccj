import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { collectionScore, collectionStats, playerLevel, usePlayer } from "@/lib/store";
import { CARDS } from "@/lib/creatures";
import { useT } from "@/lib/i18n";
import { fetchLeaderboard } from "@/lib/player.functions";
import {
  collectionScore as scoreOf,
  collectionStats as statsOf,
  playerLevel as levelOf,
} from "@/lib/progress";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Monsters Cards" },
      {
        name: "description",
        content:
          "Top 100 collectors ranked by collection score, legendaries owned, total cards and player level.",
      },
      { property: "og:title", content: "Leaderboard — Monsters Cards" },
      { property: "og:description", content: "Top 100 collectors of Monsters Cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

const CATEGORIES = [
  { id: "score", emoji: "🏆", accent: "var(--legendary)" },
  { id: "legendary", emoji: "👑", accent: "var(--mythic)" },
  { id: "creatures", emoji: "🔥", accent: "var(--epic)" },
  { id: "level", emoji: "⭐", accent: "var(--rare)" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

type Row = {
  id: number;
  name: string;
  score: number;
  legendary: number;
  creatures: number;
  level: number;
  photoUrl?: string | null;
};

/** Telegram profile photo with a styled initial as fallback. */
function Avatar({
  row,
  className,
  style,
}: {
  row: Row;
  className: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (row.photoUrl && !failed) {
    return (
      <img
        src={row.photoUrl}
        alt={row.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
        style={style}
      />
    );
  }
  return (
    <span className={`${className} grid place-items-center`} style={style}>
      {row.name.slice(0, 1)}
    </span>
  );
}

const PODIUM = [
  { medal: "🥇", h: "h-24", frame: "var(--legendary)", delay: "0.08s" },
  { medal: "🥈", h: "h-16", frame: "var(--common)", delay: "0s" },
  { medal: "🥉", h: "h-12", frame: "var(--epic)", delay: "0.16s" },
] as const;

function LeaderboardPage() {
  const t = useT();
  const player = usePlayer();
  const [category, setCategory] = useState<CategoryId>("score");
  const stats = collectionStats(player.owned);

  const [live, setLive] = useState<Row[]>([]);

  const myId = Number(String(player.playerId).replace(/^\D+/, "")) || 0;

  const you: Row = {
    id: myId,
    name: player.name,
    score: collectionScore(player.owned),
    legendary: stats.perRarity.legendary.found,
    creatures: stats.found,
    level: playerLevel(player.xp),
    photoUrl: live.find((r) => r.id === myId)?.photoUrl ?? null,
  };

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((players) => {
        if (cancelled) return;
        const mapped = players.map((p) => {
          const st = (p.state ?? {}) as {
            owned?: Record<string, { qty: number; level: number; xp: number }>;
            xp?: number;
          };
          const owned = st.owned ?? {};
          const s = statsOf(owned);
          return {
            id: p.id,
            name: p.name,
            score: scoreOf(owned),
            legendary: s.perRarity.legendary.found,
            creatures: s.found,
            level: levelOf(Number(st.xp ?? 0)),
            photoUrl: p.photoUrl ?? null,
          } as Row;
        });
        setLive(mapped.filter((r) => r.score > 0));
      })
      .catch(() => setLive([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const all = [...live.filter((r) => r.id !== you.id), you];
    const key: Record<CategoryId, keyof Row> = {
      score: "score",
      legendary: "legendary",
      creatures: "creatures",
      level: "level",
    };
    const k = key[category];
    return all
      .sort(
        (a, b) =>
          (b[k] as number) - (a[k] as number) ||
          b.score - a.score ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, live, you.id, you.score, you.legendary, you.creatures, you.level, player.name]);

  const myRank = useMemo(() => rows.findIndex((r) => r.id === you.id) + 1, [rows, you.id]);

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [category]);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const valueOf = (r: Row) =>
    category === "score"
      ? r.score.toLocaleString()
      : category === "legendary"
        ? `${r.legendary} LEG`
        : category === "creatures"
          ? `${r.creatures}/${CARDS.length}`
          : `LVL ${r.level}`;


  return (
    <AppShell>
      <div className="px-5 pt-5">
        <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight">
          {t("rank.title")}
        </h1>
        <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.25em] text-dim">
          {t("rank.sub")}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 px-5">
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`glossy-pill relative min-h-10 min-w-0 overflow-hidden rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                active ? "scale-[1.02] text-ink" : "text-dim"
              }`}
            >
              {active && (
                <span
                  className="pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-full"
                  style={{ background: c.accent, boxShadow: `0 2px 10px ${c.accent}` }}
                />
              )}
              {t(`rank.${c.id}`)}
            </button>
          );
        })}
      </div>

      {/* Your position, always visible */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-gram/40 bg-gram/5 px-3 py-2.5">
        <Avatar
          row={you}
          className="size-9 shrink-0 overflow-hidden rounded-full bg-panel2 font-display text-xs font-bold text-dim"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-dim">
            {t("rank.yourRank")}
          </p>
          <p className="truncate font-display text-sm font-bold">{you.name}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-base font-extrabold text-gram">
            {myRank > 0 ? `#${myRank}` : t("rank.unranked")}
          </p>
          <p className="text-[10px] font-bold text-dim">{valueOf(you)}</p>
        </div>
      </div>

      {myRank > 0 && Math.floor((myRank - 1) / PAGE_SIZE) !== current && (
        <div className="mt-2 px-5">
          <button
            type="button"
            onClick={() => setPage(Math.floor((myRank - 1) / PAGE_SIZE))}
            className="glossy-pill w-full rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink"
          >
            {t("rank.jumpToMe")}
          </button>
        </div>
      )}

      {current === 0 && rows.length >= 3 && (

        <div className="mx-5 mt-5">
          <div className="soft-card rounded-3xl px-4 pb-4 pt-5">
            <div className="flex items-end justify-center gap-3">
              {(
                [
                  { r: rows[1] as Row, rank: 1 },
                  { r: rows[0] as Row, rank: 0 },
                  { r: rows[2] as Row, rank: 2 },
                ] as const
              ).map(({ r, rank }) => {
                const meta = PODIUM[rank];
                const isYou = r.id === you.id;
                return (
                  <div
                    key={`${r.id}-${rank}`}
                    className="anim-rise flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    style={{ animationDelay: meta.delay }}
                  >
                    <span className="text-base leading-none">{meta.medal}</span>
                    <Avatar
                      row={r}
                      className={`shrink-0 overflow-hidden rounded-full font-display font-bold ${
                        rank === 0 ? "size-14 text-lg" : "size-11 text-sm"
                      }`}
                      style={{
                        background: `linear-gradient(145deg, color-mix(in oklab, ${meta.frame} 38%, var(--panel)), color-mix(in oklab, ${meta.frame} 14%, var(--panel2)))`,
                        border: `2px solid ${meta.frame}`,
                        boxShadow: `0 8px 18px -8px color-mix(in oklab, ${meta.frame} 70%, transparent)`,
                        color: "var(--ink)",
                      }}
                    />
                    <span className="w-full truncate text-center font-display text-[11px] font-bold">
                      {r.name}
                    </span>
                    <span className="text-[10px] font-bold text-gram">{valueOf(r)}</span>
                    {isYou && (
                      <span className="text-[8px] font-bold uppercase tracking-widest text-gram">
                        {t("rank.you")}
                      </span>
                    )}
                    <div
                      className={`mt-1 w-full rounded-t-xl ${meta.h}`}
                      style={{
                        background: `linear-gradient(180deg, color-mix(in oklab, ${meta.frame} 34%, var(--panel)), color-mix(in oklab, ${meta.frame} 10%, var(--panel2)))`,
                        border: "1px solid color-mix(in oklab, var(--panel) 70%, var(--line))",
                        borderBottom: "none",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ol className="mt-4 space-y-1.5 px-5">
        {(current === 0 && rows.length >= 3 ? pageRows.slice(3) : pageRows).map((r, i) => {
          const rank =
            current * PAGE_SIZE + i + (current === 0 && rows.length >= 3 ? 3 : 0);
          const isYou = r.id === you.id;
          return (
            <li
              key={`${r.id}-${rank}`}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm ${
                isYou
                  ? "border-gram/50 bg-gram/5"
                  : "border-line bg-panel"
              }`}
            >
              <span className="w-7 shrink-0 text-[11px] font-bold text-dim">{rank + 1}</span>
              <Avatar
                row={r}
                className="size-8 shrink-0 overflow-hidden rounded-full bg-panel2 font-display text-xs font-bold text-dim"
              />
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold">
                {r.name}
                {isYou && (
                  <span className="ml-2 text-[8px] font-bold uppercase tracking-widest text-gram">
                    {t("rank.you")}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-bold text-gram">{valueOf(r)}</span>
            </li>
          );
        })}
        {rows.length <= 1 && (
          <li className="rounded-2xl border border-line bg-panel px-3 py-4 text-center text-[11px] font-semibold text-dim">
            {t("rank.empty")}
          </li>
        )}
      </ol>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 px-5">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="glossy-pill min-h-10 rounded-full px-4 text-[10px] font-bold uppercase tracking-wider text-ink disabled:opacity-40"
          >
            {t("rank.prev")}
          </button>
          <span className="font-display text-xs font-bold text-dim">
            {current + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
            className="glossy-pill min-h-10 rounded-full px-4 text-[10px] font-bold uppercase tracking-wider text-ink disabled:opacity-40"
          >
            {t("rank.next")}
          </button>
        </div>
      )}

    </AppShell>
  );
}
