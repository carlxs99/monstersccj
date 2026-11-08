import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { BanGate } from "./BanGate";
import { TutorialGuide } from "./TutorialGuide";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { usePlayer } from "@/lib/store";
import { useT } from "@/lib/i18n";
import logo from "@/assets/logo.webp";
import gramLogo from "@/assets/gram-logo.webp";

export function AppShell({
  children,
  showBalance = true,
}: {
  children: ReactNode;
  showBalance?: boolean;
}) {
  const player = usePlayer();

  const t = useT();

  return (
    <div className="sky-bg relative mx-auto min-h-dvh w-full max-w-[520px] overflow-x-clip font-body text-ink">
      <div className="prism-line absolute inset-x-0 top-0 z-30 h-0.5" />
      <header className="relative z-20 flex items-center justify-between gap-2 px-4 pb-3 pt-[max(env(safe-area-inset-top),20px)] sm:px-5">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 leading-none">
          <img
            src={logo}
            alt="Monsters Cards logo"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-xl drop-shadow-[0_4px_10px_rgba(30,27,75,0.35)]"
          />
          <div className="min-w-0">
            <div className="truncate font-display text-[13px] font-extrabold sm:text-[15px]">
              MONSTERS CARDS
            </div>
            <div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.12em] text-dim">
              {t("shell.hub")}
            </div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {showBalance && (
            <Link
              to="/wallet"
              className="glossy-pill flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5"
            >
              <img
                src={gramLogo}
                alt="GRAM"
                className="size-4 rounded-full shadow-[0_0_10px_rgba(0,152,234,0.45)]"
              />
              <span className="text-[13px] font-bold text-ink">{player.gram.toFixed(2)}</span>
              <span className="balance-label text-[8px] font-bold text-dim">GRAM</span>
            </Link>
          )}
          <LanguageSwitcher />
        </div>
      </header>
      <BanGate />

      <main className="relative pb-[calc(8.5rem+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNav />
      <TutorialGuide />
    </div>
  );
}
