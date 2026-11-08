import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Send, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatGram } from "@/lib/economy";
import { REFERRAL_RATES, referralTotals, usePlayer } from "@/lib/store";
import { fetchReferrals, getBotUsername } from "@/lib/player.functions";
import { initData, isTelegram } from "@/lib/telegram";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — Monsters Cards" },
      {
        name: "description",
        content:
          "Invite friends to Monsters Cards and earn 10% of level 1 purchases, 5% of level 2 and 1% of level 3 — paid in GRAM.",
      },
      { property: "og:title", content: "Referrals — Monsters Cards" },
      { property: "og:description", content: "Earn GRAM commissions from three referral levels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReferralsPage,
});

const LEVELS = ["l1", "l2", "l3"] as const;

function ReferralsPage() {
  const t = useT();
  const stored = usePlayer();
  const [live, setLive] = useState<{
    referrals: { l1: number; l2: number; l3: number };
    referralEarned: { l1: number; l2: number; l3: number };
    referredBy: number | null;
  } | null>(null);
  const player = live
    ? {
        ...stored,
        referrals: live.referrals,
        referralEarned: live.referralEarned,
        referredBy: live.referredBy
          ? "GR" + String(live.referredBy % 1000000).padStart(6, "0")
          : stored.referredBy,
      }
    : stored;
  const totals = referralTotals(player);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Always show the current network: re-read it from the server on every visit.
  useEffect(() => {
    if (!isTelegram() || !initData()) return;
    let alive = true;
    const load = () =>
      fetchReferrals({ data: { initData: initData() } })
        .then((res) => alive && setLive(res))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);


  useEffect(() => {
    let alive = true;
    const fallback = `https://t.me/MonstersCardsBot/app?startapp=${player.referralCode}`;
    getBotUsername()
      .then((res) => {
        if (!alive) return;
        setLink(res.base ? `${res.base}?startapp=${player.referralCode}` : fallback);
      })
      .catch(() => alive && setLink(fallback));
    return () => {
      alive = false;
    };
  }, [player.referralCode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <AppShell>
      <div className="px-5 pt-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-dim">
          {t("invite.network")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight">
          {t("invite.title")}
        </h1>
        <p className="mt-2 text-[11px] leading-snug text-dim">{t("invite.intro")}</p>
      </div>

      {/* Earnings summary */}
      <section className="px-5 pt-4">
        <div className="soft-card grid grid-cols-2 gap-2 rounded-2xl p-4 text-center">
          <div>
            <div className="font-display text-2xl font-extrabold text-gram">
              {totals.earned.toFixed(2)}
            </div>
            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-dim">
              {t("invite.earned")}
            </div>
          </div>
          <div>
            <div className="font-display text-2xl font-extrabold">{totals.people}</div>
            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-dim">
              {t("invite.size")}
            </div>
          </div>
        </div>
      </section>

      {/* Invite link */}
      <section className="px-5 pt-4">
        <div className="soft-card rounded-2xl p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-dim">
            {t("invite.linkLabel")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="glossy-pill flex-1 truncate rounded-xl px-3 py-2.5 text-[11px] font-bold">
              {link || "…"}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label={t("invite.linkLabel")}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-dark text-white transition-transform active:scale-95"
            >
              {copied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t("invite.shareText"))}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rare px-4 text-[11px] font-extrabold uppercase tracking-wider text-white transition-transform active:scale-[0.98]"
          >
            <Send size={14} aria-hidden="true" /> {t("invite.share")}
          </a>
          <p className="mt-2 text-[9px] leading-snug text-dim">{t("invite.autoNote")}</p>
        </div>
      </section>

      {/* Commission levels */}
      <section className="px-5 pt-5">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-dim">
          {t("invite.levels")}
        </h2>
        <div className="mt-2 space-y-2">
          {LEVELS.map((key) => (
            <div key={key} className="soft-card flex items-center gap-3 rounded-2xl p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel2 text-rare">
                <Users size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-extrabold">{t(`invite.${key}`)}</h3>
                  <span className="rounded-full bg-gram/15 px-2 py-0.5 text-[9px] font-extrabold text-gram">
                    {Math.round(REFERRAL_RATES[key] * 100)}%
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-dim">{t(`invite.${key}note`)}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-sm font-extrabold">{player.referrals[key]}</div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-dim">
                  {formatGram(player.referralEarned[key])} G
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Invited by */}
      <section className="px-5 pt-5">
        <div className="soft-card rounded-2xl p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-dim">
            {t("invite.wereYou")}
          </p>
          <p className="mt-2 text-[11px] leading-snug">
            {player.referredBy ? (
              <>
                {t("invite.by")} <span className="font-bold text-rare">{player.referredBy}</span>
              </>
            ) : (
              <span className="text-dim">{t("invite.alone")}</span>
            )}
          </p>
        </div>
      </section>

      <p className="px-5 pt-4 text-[9px] leading-snug text-dim">{t("invite.footer")}</p>
    </AppShell>
  );
}
