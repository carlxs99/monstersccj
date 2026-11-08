import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shield, Swords, Sparkles, RefreshCw, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreatureSigil } from "@/components/CreatureSigil";
import { rarityText } from "@/components/rarity";
import { CARDS_BY_ID } from "@/lib/creatures";
import { useT } from "@/lib/i18n";
import { haptic, initData, isTelegram } from "@/lib/telegram";

import { usePlayer } from "@/lib/store";
import { MIN_WAGER, TEAM_SIZE, TURN_MS, buildFighter, type BattleAction } from "@/lib/battle";
import {
  battleActionCloud,
  battleTimeoutCloud,
  cancelBattleCloud,
  createBattleCloud,
  joinBattleCloud,
  listBattlesCloud,
  
  type BattleView,
} from "@/lib/battle.functions";

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "Battle Arena — Monsters Cards" },
      {
        name: "description",
        content:
          "Duel other Monsters Cards collectors: wager GRAM, pick three creatures and fight turn by turn. Winner takes the whole pot.",
      },
      { property: "og:title", content: "Battle Arena — Monsters Cards" },
      {
        property: "og:description",
        content: "Turn-based PvP duels with GRAM wagers and no house fee.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BattlePage,
});

type Lobby = Awaited<ReturnType<typeof listBattlesCloud>>;

function errText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function BattlePage() {
  const t = useT();
  const player = usePlayer();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [wager, setWager] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamPage, setTeamPage] = useState(0);
  const inTelegram = typeof window !== "undefined" && isTelegram();
  const wagerValue = Number(wager.replace(",", "."));
  const canAffordWager =
    Number.isFinite(wagerValue) && wagerValue >= MIN_WAGER && player.gram + 1e-9 >= wagerValue;

  const ownedCreatures = useMemo(
    () =>
      Object.entries(player.owned)
        .map(([id, entry]) => {
          const card = CARDS_BY_ID[id];
          if (!card) return null;
          const fighter = buildFighter(id, entry);
          return { card, fighter, qty: entry.qty };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .sort((a, b) => b.fighter.atk - a.fighter.atk),
    [player.owned],
  );

  const CREATURES_PER_PAGE = 8;
  const teamPageCount = Math.max(1, Math.ceil(ownedCreatures.length / CREATURES_PER_PAGE));
  const safeTeamPage = Math.min(teamPage, teamPageCount - 1);
  const pagedCreatures = ownedCreatures.slice(
    safeTeamPage * CREATURES_PER_PAGE,
    safeTeamPage * CREATURES_PER_PAGE + CREATURES_PER_PAGE,
  );

  const refresh = useCallback(async () => {
    if (!inTelegram) return;
    try {
      const next = await listBattlesCloud({ data: { initData: initData() } });
      setLobby(next);
    } catch (e) {
      setError(errText(e));
    }
  }, [inTelegram]);

  // Adaptive polling: fast only while a duel is actually running, slow while
  // just browsing the lobby, and fully paused when the app is in the
  // background. Keeps the Arena from hammering the server all day.
  const lobbyRef = useRef(lobby);
  lobbyRef.current = lobby;

  useEffect(() => {
    if (!inTelegram) return;
    let timer = 0;
    let stopped = false;

    const delay = () => {
      const current = lobbyRef.current?.active ?? null;
      const status = (current as { status?: string } | null)?.status;
      if (status === "active" || status === "fighting") return 4000;
      if (current) return 8000;
      return 20000;
    };

    const tick = async () => {
      if (stopped) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        await refresh();
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), delay());
    };

    void tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, inTelegram]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      haptic("medium");
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setTeam((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= TEAM_SIZE
          ? prev
          : [...prev, id],
    );

  const active = lobby?.active ?? null;


  return (
    <AppShell>
      <div className="px-5 pt-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-dim">
          {t("battle.kicker")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight">
          {t("battle.title")}
        </h1>
        <p className="mt-2 text-[11px] leading-snug text-dim">{t("battle.subtitle")}</p>
        <p className="mt-1 text-[10px] text-dim/80">
          {t("battle.rules", { s: Math.round(TURN_MS / 1000) })}
        </p>
      </div>

      {error ? (
        <div className="mx-5 mt-4 rounded-xl border border-legendary/40 bg-legendary/10 px-3 py-2 text-[11px] font-semibold text-legendary">
          {error}
        </div>
      ) : null}

      {!inTelegram ? (
        <p className="mx-5 mt-6 rounded-2xl border border-line bg-panel/60 px-4 py-6 text-center text-[12px] text-dim">
          {t("battle.onlyTelegram")}
        </p>
      ) : active ? (
        <LiveBattle
          battle={active}
          me={lobby!.me}
          busy={busy}
          onAction={async (action, target, self) => {
            setBusy(true);
            setError(null);
            try {
              await battleActionCloud({
                data: { initData: initData(), id: active.id, action, target, self },
              });

              haptic("medium");
              await refresh();
              // Pause so the player sees their action before the bot responds.
              await new Promise((r) => setTimeout(r, 1500));
              await refresh();
            } catch (e) {
              setError(errText(e));
            } finally {
              setBusy(false);
            }
          }}
          onTimeout={() =>
            run(() => battleTimeoutCloud({ data: { initData: initData(), id: active.id } }))
          }
        />
      ) : (
        <>
          {lobby?.myOpen?.length ? (
            <section className="px-5 pt-5">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-dim">
                {t("battle.yourRoom")}
              </h2>
              {lobby.myOpen.map((room) => (
                <div
                  key={room.id}
                  className="soft-card mt-2 flex items-center justify-between rounded-2xl px-4 py-3"
                >
                  <div>
                    <div className="font-display text-sm font-extrabold text-gram">
                      {t("battle.pot", { v: (room.wager * 2).toFixed(2) })}
                    </div>
                    <div className="text-[10px] text-dim">{t("battle.waiting")}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        cancelBattleCloud({ data: { initData: initData(), id: room.id } }),
                      )
                    }
                    className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-dim disabled:opacity-50"
                  >
                    <X size={13} /> {t("battle.cancel")}
                  </button>
                </div>
              ))}
            </section>
          ) : (
            <section className="px-5 pt-5">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-dim">
                {t("battle.pickTeam")}
              </h2>
              {ownedCreatures.length < TEAM_SIZE ? (
                <p className="soft-card mt-2 rounded-2xl px-4 py-5 text-center text-[11px] text-dim">
                  {t("battle.needCreatures")}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-[10px] text-dim">
                    {t("battle.pickHint", { n: team.length })}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {pagedCreatures.map(({ card, fighter }) => {
                      const picked = team.includes(card.id);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => toggle(card.id)}
                          className={`relative overflow-hidden rounded-xl border p-1 transition ${
                            picked ? "border-rare bg-rare/10" : "border-line bg-panel/60"
                          }`}
                        >
                          <div className="aspect-[0.72] overflow-hidden rounded-lg bg-panel2">
                            <CreatureSigil creature={card} />
                          </div>
                          <div
                            className={`mt-1 truncate text-[8px] font-bold ${rarityText[card.rarity]}`}
                          >
                            {card.name}
                          </div>
                          <div className="mt-0.5 flex items-center justify-center gap-1 text-[7px] font-semibold leading-tight text-dim">
                            <span>Lv.{fighter.level}</span>
                            <span aria-hidden>·</span>
                            <span>{fighter.hp} HP</span>
                          </div>
                          <div className="flex items-center justify-center gap-1 text-[7px] font-semibold leading-tight text-dim">
                            <span>{fighter.atk} ATK</span>
                            <span aria-hidden>·</span>
                            <span>{fighter.def} DEF</span>
                            <span aria-hidden>·</span>
                            <span>{fighter.spd} SPD</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {teamPageCount > 1 ? (
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        disabled={safeTeamPage === 0}
                        onClick={() => setTeamPage((p) => Math.max(0, p - 1))}
                        className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-dim disabled:opacity-30"
                      >
                        ‹ {t("battle.prev")}
                      </button>
                      <span className="text-[11px] font-bold text-dim">
                        {safeTeamPage + 1}/{teamPageCount}
                      </span>
                      <button
                        type="button"
                        disabled={safeTeamPage >= teamPageCount - 1}
                        onClick={() => setTeamPage((p) => Math.min(teamPageCount - 1, p + 1))}
                        className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-dim disabled:opacity-30"
                      >
                        {t("battle.next")} ›
                      </button>
                    </div>
                  ) : null}

                  <div className="soft-card mt-4 rounded-2xl p-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dim">
                      {t("battle.wager")}
                    </label>
                    <input
                      value={wager}
                      onChange={(e) => setWager(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-line bg-panel2 px-3 py-2 font-display text-lg font-extrabold text-gram outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      {[0.5, 1, 5, 25].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setWager(String(v))}
                          className="flex-1 rounded-lg border border-line py-1.5 text-[11px] font-bold text-dim"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy || team.length !== TEAM_SIZE || !canAffordWager}
                      onClick={() =>
                        run(() =>
                          createBattleCloud({
                            data: { initData: initData(), wager: wagerValue, team },
                          }),
                        )
                      }
                      className="mt-3 w-full rounded-xl bg-gram py-3 font-display text-sm font-extrabold text-void disabled:opacity-40"
                    >
                      {busy ? t("battle.creating") : t("battle.create")}
                    </button>
                    {Number.isFinite(wagerValue) &&
                      wagerValue >= MIN_WAGER &&
                      player.gram + 1e-9 < wagerValue && (
                        <p className="mt-2 text-center text-[11px] font-semibold text-legendary">
                          {t("wallet.notEnough")}
                        </p>
                      )}
                  </div>
                </>
              )}
            </section>
          )}

          <section className="px-5 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-dim">
                {t("battle.openRooms")}
              </h2>
              <button
                type="button"
                onClick={() => void refresh()}
                className="flex items-center gap-1 text-[10px] font-bold text-dim"
              >
                <RefreshCw size={12} /> {t("battle.refresh")}
              </button>
            </div>
            {!lobby?.open.length ? (
              <p className="soft-card mt-2 rounded-2xl px-4 py-5 text-center text-[11px] text-dim">
                {t("battle.noRooms")}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {lobby.open.map((room) => {
                  const affordable = player.gram + 1e-9 >= room.wager;
                  return (
                    <div
                      key={room.id}
                      className="soft-card flex items-center justify-between rounded-2xl px-4 py-3"
                    >
                      <div>
                        <div className="text-[12px] font-bold">{room.hostName}</div>
                        <div className="font-display text-sm font-extrabold text-gram">
                          {t("battle.pot", { v: (room.wager * 2).toFixed(2) })}
                        </div>
                        {!affordable && (
                          <div className="text-[10px] font-semibold text-legendary">
                            {t("wallet.notEnough")}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy || team.length !== TEAM_SIZE || !affordable}
                        onClick={() =>
                          run(() =>
                            joinBattleCloud({
                              data: { initData: initData(), id: room.id, team },
                            }),
                          )
                        }
                        className="rounded-xl bg-rare px-4 py-2 text-[11px] font-extrabold text-void disabled:opacity-40"
                      >
                        {t("battle.join")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="px-5 pb-6 pt-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-dim">
              {t("battle.history")}
            </h2>
            {!lobby?.history.length ? (
              <p className="soft-card mt-2 rounded-2xl px-4 py-5 text-center text-[11px] text-dim">
                {t("battle.noHistory")}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {lobby.history.map((row) => {
                  const won = row.winnerId === lobby.me;
                  return (
                    <div
                      key={row.id}
                      className="soft-card flex items-center justify-between rounded-2xl px-4 py-3"
                    >
                      <div className="text-[11px] font-semibold text-dim">
                        {row.hostName} {t("battle.vs")} {row.guestName}
                      </div>
                      <div
                        className={`font-display text-sm font-extrabold ${won ? "text-gram" : "text-legendary"}`}
                      >
                        {won ? "+" : "−"}
                        {row.wager.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.round((hp / maxHp) * 100));
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel2">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: pct > 50 ? "var(--gram)" : pct > 20 ? "var(--mythic)" : "var(--legendary)",
        }}
      />
    </div>
  );
}

/** A floating combat number that rises and fades over the arena. */
function FloatFx({ fx }: { fx: { key: number; text: string; kind: string } }) {
  return (
    <div
      key={fx.key}
      className={`battle-float pointer-events-none absolute left-1/2 top-1/2 z-20 font-display font-extrabold ${
        fx.kind === "crit"
          ? "text-3xl text-legendary drop-shadow-[0_0_10px_var(--legendary)]"
          : fx.kind === "hit"
            ? "text-2xl text-legendary"
            : fx.kind === "heal"
              ? "text-xl text-gram"
              : "text-lg text-dim"
      }`}
    >
      {fx.text}
    </div>
  );
}

function TeamRow({
  side,
  label,
  selectable = false,
  selected,
  onSelect,
  fx,
}: {
  side: BattleView["state"] extends null ? never : NonNullable<BattleView["state"]>["host"];
  label: string;
  selectable?: boolean;
  selected?: number;
  onSelect?: (index: number) => void;
  fx?: { key: number; kind: string } | null;
}) {
  const shaking = fx?.kind === "hit" || fx?.kind === "crit";
  const healing = fx?.kind === "heal";
  return (
    <div
      className={`soft-card relative rounded-2xl p-3 ${shaking ? "battle-shake" : ""}`}
    >
      {healing ? (
        <div className="battle-heal pointer-events-none absolute inset-0 rounded-2xl" />
      ) : null}
      {shaking ? (
        <div className="battle-flash pointer-events-none absolute inset-0 rounded-2xl" />
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dim">{label}</span>
        <span className="text-[11px] font-bold">{side.name}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {side.team.map((f, i) => {
          const card = CARDS_BY_ID[f.id];
          const down = f.hp === 0;
          const highlighted = selectable ? selected === i : i === side.active;
          return (
            <button
              key={f.id}
              type="button"
              disabled={!selectable || down}
              onClick={() => onSelect?.(i)}
              className={`rounded-xl border p-1.5 text-left transition ${
                highlighted ? "border-rare bg-rare/10" : "border-line bg-panel/50"
              } ${down ? "opacity-40 grayscale" : ""}`}
            >
              <div className="relative aspect-[0.9] overflow-hidden rounded-lg bg-panel2">
                {card ? <CreatureSigil creature={card} /> : null}
                {f.guard && !down ? (
                  <span className="absolute left-1 top-1 grid size-4 place-items-center rounded-full bg-rare text-void">
                    <Shield size={9} />
                  </span>
                ) : null}
                {selectable && highlighted && !down ? (
                  <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-legendary text-void">
                    <Swords size={9} />
                  </span>
                ) : null}
              </div>
              <div className={`mt-1 truncate text-[9px] font-extrabold ${rarityText[f.rarity]}`}>
                {f.name}
              </div>
              <div className="text-[8px] text-dim">
                {f.hp}/{f.maxHp}
              </div>
              <HpBar hp={f.hp} maxHp={f.maxHp} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveBattle({
  battle,
  me,
  busy,
  onAction,
  onTimeout,
}: {
  battle: BattleView;
  me: number;
  busy: boolean;
  onAction: (action: BattleAction, target: number, self: number) => void;
  onTimeout: () => void;
}) {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  const [target, setTarget] = useState<number | null>(null);
  const [mine_, setMine] = useState<number | null>(null);
  const [fx, setFx] = useState<{ key: number; kind: string; text: string; victim: "mine" | "foe" | null } | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = battle.state;
  const lastEntry = state?.log[state.log.length - 1];

  // Play a short combat animation whenever the log gains a new entry.
  useEffect(() => {
    if (!state || !lastEntry) return;
    const meId = me;
    const victim = lastEntry.actor === meId ? "foe" : "mine";
    let kind = "info";
    let text = "";
    if (lastEntry.miss) {
      kind = "miss";
      text = "MISS";
    } else if (lastEntry.damage > 0) {
      const crit = lastEntry.text.includes("(critical!");
      kind = crit ? "crit" : "hit";
      text = `-${lastEntry.damage}${crit ? "!" : ""}`;
    } else if (lastEntry.heal > 0) {
      kind = "heal";
      text = `+${lastEntry.heal}`;
    } else if (lastEntry.action === "defend") {
      kind = "heal";
      text = "🛡";
    }
    if (!text) return;
    const fxVictim = lastEntry.heal > 0 || lastEntry.action === "defend" ? (victim === "foe" ? "mine" : "foe") : victim;
    setFx({ key: lastEntry.seq, kind, text, victim: fxVictim });
    haptic(lastEntry.damage > 0 ? "heavy" : "light");
    const id = window.setTimeout(() => setFx(null), 1100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.seq]);


  if (!state) return null;
  const mine = state.host.telegramId === me ? state.host : state.guest;
  const foe = state.host.telegramId === me ? state.guest : state.host;
  const myTurn = state.turn === me;
  const left = Math.max(0, Math.ceil((Date.parse(battle.turnAt) + TURN_MS - now) / 1000));
  const validSelf =
    mine_ !== null && mine.team[mine_] && mine.team[mine_]!.hp > 0
      ? mine_
      : mine.team[mine.active] && mine.team[mine.active]!.hp > 0
        ? mine.active
        : mine.team.findIndex((f) => f.hp > 0);
  const activeFighter = mine.team[validSelf];
  const validTarget =
    target !== null && foe.team[target] && foe.team[target]!.hp > 0
      ? target
      : foe.team.findIndex((f) => f.hp > 0);


  return (
    <div className="space-y-3 px-5 pt-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dim">
          {t("battle.live")}
        </span>
        <span className="font-display text-sm font-extrabold text-gram">
          {t("battle.pot", { v: (battle.wager * 2).toFixed(2) })}
        </span>
      </div>

      <div className="relative space-y-3">
        {fx ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className={`absolute left-1/2 ${fx.victim === "foe" ? "top-4" : "bottom-24"}`}>
              <FloatFx fx={fx} />
            </div>
          </div>
        ) : null}
        <TeamRow
          side={foe}
          label={t("battle.opponentTurn")}
          selectable
          selected={validTarget}
          onSelect={setTarget}
          fx={fx && fx.victim === "foe" ? fx : null}
        />
        {myTurn ? (
          <p className="-mt-1 text-center text-[10px] text-dim">{t("battle.target")}</p>
        ) : null}
        <TeamRow
          side={mine}
          label={t("battle.yourTurn")}
          selectable
          selected={validSelf}
          onSelect={setMine}
          fx={fx && fx.victim === "mine" ? fx : null}
        />
      </div>
      {myTurn ? (
        <p className="-mt-1 text-center text-[10px] text-dim">{t("battle.mine")}</p>
      ) : null}

      <div className="soft-card rounded-2xl p-3 text-center">
        <div className="text-[11px] font-extrabold">
          {myTurn ? t("battle.yourTurn") : t("battle.opponentTurn")}
        </div>
        <div className="text-[10px] text-dim">{t("battle.timeLeft", { s: left })}</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!myTurn || busy}
            onClick={() => onAction("attack", validTarget, validSelf)}
            className="flex flex-col items-center gap-1 rounded-xl bg-legendary/90 py-3 text-[11px] font-extrabold text-void disabled:opacity-40"
          >
            <Swords size={16} /> {t("battle.attack")}
          </button>
          <button
            type="button"
            disabled={!myTurn || busy}
            onClick={() => onAction("defend", validTarget, validSelf)}
            className="flex flex-col items-center gap-1 rounded-xl bg-rare/90 py-3 text-[11px] font-extrabold text-void disabled:opacity-40"
          >
            <Shield size={16} /> {t("battle.defend")}
          </button>
          <button
            type="button"
            disabled={!myTurn || busy || Boolean(activeFighter?.specialUsed)}
            onClick={() => onAction("special", validTarget, validSelf)}
            className="flex flex-col items-center gap-1 rounded-xl bg-mythic/90 py-3 text-[11px] font-extrabold text-void disabled:opacity-40"
          >
            <Sparkles size={16} />{" "}
            {activeFighter?.specialUsed ? t("battle.specialUsed") : t("battle.special")}
          </button>
        </div>

        {!myTurn && left === 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={onTimeout}
            className="mt-3 w-full rounded-xl border border-line py-2 text-[11px] font-bold text-dim"
          >
            {t("battle.claimTimeout")}
          </button>
        ) : null}
      </div>

      <div className="soft-card rounded-2xl p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-dim">
          {t("battle.log")}
        </div>
        <div className="mt-2 space-y-1">
          {[...state.log]
            .slice(-8)
            .reverse()
            .map((entry) => (
              <div key={entry.seq} className="text-[10px] leading-snug text-dim">
                {entry.text}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
