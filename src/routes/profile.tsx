import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { dailyYield, formatGram } from "@/lib/economy";
import { YieldVault } from "@/components/YieldVault";
import { collectionScore, collectionStats, playerLevel, setName, usePlayer } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { tgUser } from "@/lib/telegram";
import { ADMIN_TELEGRAM_ID } from "@/lib/admin.functions";
import { openTutorial } from "@/components/TutorialGuide";
import { CREATURES, TRAINERS } from "@/lib/creatures";
import { Button } from "@/components/ui/button";
import { BarChart3, BookOpen, PackageOpen, Sparkles, WalletCards, Zap } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Monsters Cards" },
      {
        name: "description",
        content:
          "Your collector profile: level, XP, cards owned, trainers, album completion and packs opened.",
      },
      { property: "og:title", content: "Profile — Monsters Cards" },
      { property: "og:description", content: "Your Monsters Cards collector profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const t = useT();
  const player = usePlayer();
  const stats = collectionStats(player.owned);
  const level = playerLevel(player.xp);
  const xpInLevel = player.xp % 500;
  const telegramUser = tgUser();
  const displayName = telegramUser?.username ? `@${telegramUser.username}` : player.name;

  const cells = [
    { label: t("profile.cards"), value: `${stats.found}/${stats.total}`, icon: BookOpen },
    {
      label: t("profile.creatures"),
      value: `${stats.creaturesFound}/${CREATURES.length}`,
      icon: Sparkles,
    },
    {
      label: t("profile.trainers"),
      value: `${stats.trainersFound}/${TRAINERS.length}`,
      icon: Zap,
    },
    {
      label: t("profile.legendary"),
      value: `${stats.perRarity.legendary.found}/${stats.perRarity.legendary.total}`,
      icon: Sparkles,
    },
    { label: t("profile.album"), value: `${stats.percent}%`, icon: BarChart3 },
    { label: t("profile.packsOpened"), value: String(player.packsOpened), icon: PackageOpen },
    {
      label: t("profile.score"),
      value: collectionScore(player.owned).toLocaleString(),
      icon: BarChart3,
    },
    { label: t("profile.gram"), value: player.gram.toFixed(2), icon: WalletCards },
    { label: t("profile.gramDay"), value: formatGram(dailyYield(player.owned)), icon: Zap },
    { label: t("profile.mined"), value: formatGram(player.totalEarned), icon: WalletCards },
  ];

  return (
    <AppShell>
      <div className="px-5 pt-5">
        <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight">
          {t("profile.title")}
        </h1>
      </div>

      <div className="px-5 pt-5">
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="h-1 bg-gradient-to-r from-gram via-epic to-mythic" />
          <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="holo absolute -inset-0.5 rounded-full opacity-80" />
              <div className="relative grid size-16 place-items-center overflow-hidden rounded-full bg-dark font-display text-xl font-extrabold text-panel">
                {telegramUser?.photo_url ? (
                  <img
                    src={telegramUser.photo_url}
                    alt={displayName}
                    width={64}
                    height={64}
                    className="size-full object-cover"
                  />
                ) : (
                  player.name.slice(0, 1).toUpperCase()
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={player.name}
                onChange={(e) => setName(e.target.value.slice(0, 18))}
                className="w-full bg-transparent font-display text-xl font-extrabold outline-none"
                aria-label={t("profile.name")}
              />
              {telegramUser?.username ? (
                <div className="mt-0.5 truncate text-xs font-semibold text-rare">{displayName}</div>
              ) : null}
              <div className="mt-0.5 text-[9px] font-bold uppercase leading-relaxed tracking-wider text-dim">
                <span className="whitespace-nowrap">ID {player.playerId}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-dim">
              <span>{t("profile.level", { n: level })}</span>
              <span>{xpInLevel}/500 XP</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gram via-epic to-mythic"
                style={{ width: `${(xpInLevel / 500) * 100}%` }}
              />
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
        {cells.map((c) => {
          const Icon = c.icon;
          return (
          <div key={c.label} className="rounded-xl border border-line bg-panel p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-dim">
              <Icon size={13} aria-hidden="true" />
              <span>{c.label}</span>
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">{c.value}</div>
          </div>
          );
        })}
      </div>

      <div className="px-5 pt-4">
        <YieldVault />
      </div>

      <div className="px-5 pt-5">
        <div className="rounded-3xl border border-gram/30 bg-gram/5 p-4">
          <div className="font-display text-sm font-bold">{t("profile.topup")}</div>
          <p className="mt-1 text-[9px] leading-relaxed text-dim">{t("profile.topupNote")}</p>
          <Link
            to="/wallet"
            className="mt-3 block w-full rounded-2xl bg-ink py-3 text-center font-display text-sm font-bold uppercase tracking-widest text-panel"
          >
            {t("profile.openWallet")}
          </Link>
        </div>
      </div>

      {tgUser()?.id === ADMIN_TELEGRAM_ID ? (
        <div className="px-5 pt-4">
          <Link
            to="/admin"
            className="block w-full rounded-2xl bg-panel2 py-3 text-center font-display text-xs font-bold uppercase tracking-widest text-rare"
          >
            Admin panel
          </Link>
        </div>
      ) : null}

      <div className="px-5 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={openTutorial}
          className="h-11 w-full rounded-xl font-display text-xs font-bold uppercase tracking-widest text-dim"
        >
          {t("tutorial.replay")}
        </Button>
      </div>
    </AppShell>
  );
}
