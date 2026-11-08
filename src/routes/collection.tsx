import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CardTile } from "@/components/CardTile";
import { CreatureCard } from "@/components/CreatureCard";
import { Button } from "@/components/ui/button";
import { rarityText } from "@/components/rarity";
import { CARDS, CREATURES, RARITIES, RARITY_LABEL, TRAINERS } from "@/lib/creatures";
import { creatureYield, formatGram, levelMultiplier } from "@/lib/economy";
import { collectionStats, usePlayer } from "@/lib/store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/collection")({
  head: () => ({
    meta: [
      { title: "Collection — Monsters Cards" },
      {
        name: "description",
        content:
          "Track every original creature and trainer card you discover, including levels, rarity and collection progress.",
      },
      { property: "og:title", content: "Collection — Monsters Cards" },
      {
        property: "og:description",
        content: "Your album of original creature and trainer cards across five rarities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const t = useT();
  const player = usePlayer();
  const stats = collectionStats(player.owned);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "creature" | "trainer">("all");
  const creature = CARDS.find((c) => c.id === selected) ?? null;
  const entry = creature ? player.owned[creature.id] : undefined;

  return (
    <AppShell>
      <div className="px-5 pt-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-dim">
          {t("album.archive")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold leading-none">
          {t("album.title")}
        </h1>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-dim">
            {t("album.discovered", { a: stats.found, b: stats.total })}
          </span>
          <span className="font-display text-xl font-extrabold text-gram">{stats.percent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gram via-epic to-mythic"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[9px] font-bold">
          {RARITIES.map((r) => (
            <div key={r} className="rounded-lg border border-line bg-panel py-1.5">
              <div className={rarityText[r]}>
                {stats.perRarity[r].found}/{stats.perRarity[r].total}
              </div>
              <div className="text-dim">{RARITY_LABEL[r].slice(0, 4)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-panel/70 p-1.5">
          {(["all", "creature", "trainer"] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              variant={filter === kind ? "default" : "ghost"}
              onClick={() => setFilter(kind)}
              className="h-9 rounded-xl text-[9px] font-bold uppercase tracking-wider"
            >
              {kind === "all"
                ? t("album.all", { n: stats.total })
                : kind === "creature"
                  ? t("album.creatures", { a: stats.creaturesFound, b: CREATURES.length })
                  : t("album.trainers", { a: stats.trainersFound, b: TRAINERS.length })}
            </Button>
          ))}
        </div>
      </div>

      {RARITIES.map((r) => (
        <section key={r} className="collection-rarity-section px-5 pt-6">
          <div className="flex items-center justify-between">
            <span className={`font-display text-sm font-bold tracking-tight ${rarityText[r]}`}>
              {RARITY_LABEL[r]}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-dim">
              {stats.perRarity[r].found}/{stats.perRarity[r].total}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {CARDS.filter((c) => c.rarity === r && (filter === "all" || c.kind === filter)).map(
              (c) => (
                <CardTile
                  key={c.id}
                  creature={c}
                  owned={Boolean(player.owned[c.id])}
                  qty={player.owned[c.id]?.qty}
                  level={player.owned[c.id]?.level}
                  onClick={() => player.owned[c.id] && setSelected(c.id)}
                />
              ),
            )}
          </div>
        </section>
      ))}

      {creature && entry && (
        <div
          className="fixed inset-0 z-[100] mx-auto flex max-w-[520px] items-start justify-center overflow-y-auto bg-dark/70 px-5 pb-7 pt-[max(env(safe-area-inset-top),56px)] backdrop-blur-md"
          onClick={() => setSelected(null)}
        >
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t("common.close")}
            onClick={() => setSelected(null)}
            className="fixed right-4 top-4 z-[110] rounded-full border border-panel/50 bg-panel/90 shadow-lg"
          >
            <X />
          </Button>
          <div
            className="flex w-full max-w-[330px] flex-col items-center anim-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-[0.7] w-[min(76vw,290px)]">
              <CreatureCard creature={creature} level={entry.level} qty={entry.qty} size="detail" />
            </div>
            <div className="soft-card mt-4 w-full rounded-2xl p-4">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-dim">
                <span>{t("album.level", { n: entry.level })}</span>
                <span>{entry.xp % 100}/100 XP</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gram to-mythic"
                  style={{ width: `${entry.xp % 100}%` }}
                />
              </div>
              <p className="mt-2 text-[9px] text-dim">{t("album.dupNote")}</p>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-gram/30 bg-gram/5 px-3 py-2.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-dim">
                  {t("album.produces", {
                    n: entry.level,
                    m: levelMultiplier(entry.level).toFixed(2),
                  })}
                </span>
                <span className="font-display text-sm font-bold text-gram">
                  {formatGram(creatureYield(creature.id, entry))} {t("common.perDay")}
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setSelected(null)}
              className="mt-4 h-11 w-full rounded-2xl font-display font-bold uppercase"
            >
              {t("common.close")}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
