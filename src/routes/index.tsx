import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid, ListChecks, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreatureSigil } from "@/components/CreatureSigil";
import { YieldVault } from "@/components/YieldVault";
import { rarityText } from "@/components/rarity";
import { CARDS_BY_ID, RARITY_LABEL } from "@/lib/creatures";
import { creatureYield, formatGram } from "@/lib/economy";
import { collectionStats, usePlayer } from "@/lib/store";
import { tasksSummary } from "@/lib/tasks";
import { PACKS } from "@/lib/packs";
import { PackImage } from "@/components/PackImage";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Monsters Cards — Open packs, collect original cards" },
      {
        name: "description",
        content:
          "A Telegram mini app where you rip holographic packs with GRAM, pull original creatures across five rarities and complete your album.",
      },
      { property: "og:title", content: "Monsters Cards — Collect them all" },
      {
        property: "og:description",
        content: "Rip holographic packs with GRAM and collect original creatures and trainers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const t = useT();
  const player = usePlayer();
  const stats = collectionStats(player.owned);
  const taskInfo = tasksSummary(player);
  const last = player.lastPull ? CARDS_BY_ID[player.lastPull] : null;
  const lastEntry = last ? player.owned[last.id] : undefined;

  return (
    <AppShell showBalance>
      <section className="px-5 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-dim">
              {t("home.availableNow")}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold">
              {t("home.chooseBooster")}
            </h1>
          </div>
          <Link
            to="/packs"
            className="glossy-pill flex size-10 items-center justify-center rounded-full text-rare"
            aria-label={t("home.seeAll")}
          >
            <ArrowRight size={18} />
          </Link>
        </div>
        <Link to="/packs" className="ice-stage relative block h-64 overflow-hidden rounded-2xl">
          <div className="absolute inset-x-0 bottom-3 flex items-end justify-center">
            {PACKS.slice(0, 3).map((pack, i) => (
              <PackImage
                key={pack.id}
                pack={pack}
                className={`h-52 w-32 ${i === 1 ? "relative z-10 -mx-6" : "relative z-0 h-44 opacity-80"}`}
                shine={i === 1}
                eager={i === 1}
              />
            ))}
          </div>
          <span className="glossy-pill absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-rare">
            {t("home.openPack")}
          </span>
        </Link>
      </section>

      {/* Claim earnings */}
      <section className="px-5 pt-5">
        <YieldVault />
      </section>

      <section className="px-5 pt-4">
        <Link
          to="/wallet"
          className="soft-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
        >
          <span>
            <span className="block font-display text-sm font-extrabold text-ink">
              {t("home.depositTitle")}
            </span>
            <span className="block text-[10px] text-dim">{t("home.depositSub")}</span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-rare" />
        </Link>
      </section>

      {last ? (
        <section className="px-5 pt-4">
          <div className="soft-card flex items-center gap-3 rounded-2xl p-3">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md bg-dark">
              <CreatureSigil creature={last} eager />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-dim">
                {t("home.latest")}
              </p>
              <h2 className={`mt-1 font-display text-lg font-extrabold ${rarityText[last.rarity]}`}>
                {last.name}
              </h2>
              <p className="text-[10px] text-dim">
                {RARITY_LABEL[last.rarity]} · +
                {formatGram(lastEntry ? creatureYield(last.id, lastEntry) : last.dailyGram)}{" "}
                {t("common.perDay")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Quick stats */}
      <section className="mt-5 grid grid-cols-2 gap-3 px-5">
        <Link
          to="/collection"
          className="rounded-2xl border border-line bg-panel p-4 shadow-sm transition-transform active:scale-[0.98]"
        >
          <LayoutGrid size={18} className="text-rare" aria-hidden="true" />
          <div className="mt-4 text-xl font-extrabold">{stats.percent}%</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-dim">
            {t("home.albumComplete")}
          </div>
        </Link>
        <Link
          to="/leaderboard"
          className="rounded-2xl border border-line bg-panel p-4 shadow-sm transition-transform active:scale-[0.98]"
        >
          <Trophy size={18} className="text-legendary" aria-hidden="true" />
          <div className="mt-4 text-xl font-extrabold">{t("home.top100")}</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-dim">
            {t("home.globalRanking")}
          </div>
        </Link>
        <Link
          to="/tasks"
          className="rounded-2xl border border-line bg-panel p-4 shadow-sm transition-transform active:scale-[0.98]"
        >
          <ListChecks size={18} className="text-epic" aria-hidden="true" />
          <div className="mt-4 text-xl font-extrabold text-gram">{taskInfo.pending.toFixed(2)}</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-dim">
            {t("home.tasksReady")}
          </div>
        </Link>
        <Link
          to="/referrals"
          className="rounded-2xl border border-line bg-panel p-4 shadow-sm transition-transform active:scale-[0.98]"
        >
          <Users size={18} className="text-rare" aria-hidden="true" />
          <div className="mt-4 text-xl font-extrabold">10%</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-dim">
            {t("home.inviteEarn")}
          </div>
        </Link>
      </section>
    </AppShell>
  );
}
