import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Search,
  ShoppingCart,
  Store,
  Tag,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreatureSigil } from "@/components/CreatureSigil";
import { CreatureCard } from "@/components/CreatureCard";
import { Button } from "@/components/ui/button";
import { initData } from "@/lib/telegram";
import { applyServerState, usePlayer } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { CARDS_BY_ID, RARITIES, RARITY_LABEL, type CollectibleCard, type Rarity } from "@/lib/creatures";
import {
  marketAccess,
  marketBrowse,
  marketBuy,
  marketCancel,
  marketSell,
  tradeAccept,
  tradeBrowse,
  tradeCancel,
  tradeCreate,
  MARKET_FEE,
  PRICE_BAND,
  SUGGESTED_PRICE,
  LISTING_TTL_DAYS,
  type Listing,
  type Trade,
} from "@/lib/market.functions";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market — Trade creature cards | Monsters Cards" },
      {
        name: "description",
        content:
          "Buy, sell and swap Monsters Cards creature cards with other collectors, paying in GRAM.",
      },
      { property: "og:title", content: "Market — Trade creature cards | Monsters Cards" },
      {
        property: "og:description",
        content: "Buy, sell and swap creature cards with other collectors, paying in GRAM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketPage,
});

type Tab = "browse" | "swap" | "mine" | "sell";
type Sort = "new" | "cheap" | "pricey";

type ShowCard = (creature: CollectibleCard, level?: number, qty?: number) => void;
const CardDetailContext = createContext<ShowCard | null>(null);
function useCardDetail(): ShowCard {
  const ctx = useContext(CardDetailContext);
  if (!ctx) throw new Error("CardDetailContext missing");
  return ctx;
}


function MarketPage() {
  const t = useT();
  const player = usePlayer();
  const [access, setAccess] = useState<{ open: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [detail, setDetail] = useState<{
    creature: CollectibleCard;
    level?: number;
    qty?: number;
  } | null>(null);

  const showCard = useCallback(
    (creature: CollectibleCard, level?: number, qty?: number) => {
      setDetail({ creature, ...(level !== undefined ? { level } : {}), ...(qty !== undefined ? { qty } : {}) });
    },
    [],
  );

  const refresh = useCallback(async () => {
    const init = initData();
    const [m, t] = await Promise.all([
      marketBrowse({ data: { initData: init } }),
      tradeBrowse({ data: { initData: init } }),
    ]);
    setListings(m.listings);
    setTrades(t.trades);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const init = initData();
      if (!init || init.length < 10) {
        setAccess({ open: false });
        return;
      }
      try {
        const res = await marketAccess({ data: { initData: init } });
        if (!alive) return;
        setAccess(res);
        if (res.open) await refresh();
      } catch {
        if (alive) setAccess({ open: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("market.failed"));
    } finally {
      setBusy(null);
    }
  };

  const matches = useCallback(
    (cardId: string) => {
      const card = CARDS_BY_ID[cardId];
      if (!card) return false;
      if (rarity !== "all" && card.rarity !== rarity) return false;
      if (query.trim() && !card.name.toLowerCase().includes(query.trim().toLowerCase()))
        return false;
      return true;
    },
    [query, rarity],
  );

  const mine = useMemo(() => listings.filter((l) => l.mine), [listings]);
  const myTrades = useMemo(() => trades.filter((t) => t.mine), [trades]);

  const others = useMemo(() => {
    const list = listings.filter((l) => !l.mine && matches(l.cardId));
    if (sort === "cheap") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "pricey") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [listings, matches, sort]);

  const openTrades = useMemo(
    () => trades.filter((t) => !t.mine && matches(t.offerCardId)),
    [trades, matches],
  );

  if (access === null) {
    return (
      <AppShell>
        <div className="grid place-items-center py-24">
          <Loader2 className="size-6 animate-spin text-dim" />
        </div>
      </AppShell>
    );
  }

  if (!access.open) return <ComingSoon />;

  return (
    <CardDetailContext.Provider value={showCard}>
      <AppShell>
        <div className="px-5 pt-2">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-gram" />
          <h1 className="font-display text-xl font-extrabold tracking-tight">{t("market.title")}</h1>
          <span className="ml-auto rounded-full border border-line bg-panel px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-dim">
            {player.gram.toFixed(2)} GRAM
          </span>
        </div>
        <p className="mt-1 text-[11px] text-dim">
          {t("market.intro", { fee: Math.round(MARKET_FEE * 100) })}
        </p>

        <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-panel/70 p-1.5">
          {(
            [
              ["browse", t("market.tab.buy")],
              ["swap", t("market.tab.swap")],
              ["mine", t("market.tab.mine", { n: mine.length + myTrades.length })],
              ["sell", t("market.tab.sell")],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              variant={tab === id ? "default" : "ghost"}
              onClick={() => setTab(id)}
              className="h-9 rounded-xl px-1 text-[9px] font-bold uppercase tracking-wider"
            >
              {label}
            </Button>
          ))}
        </div>

        {(tab === "browse" || tab === "swap") && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-panel/70 px-3">
              <Search className="size-3.5 shrink-0 text-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("market.search")}
                className="w-full bg-transparent py-2 text-[12px] font-semibold text-ink outline-none placeholder:text-dim"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label={t("market.clearSearch")}>
                  <X className="size-3.5 text-dim" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(["all", ...RARITIES] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarity(r)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition ${
                    rarity === r ? "border-gram text-gram" : "border-line text-dim"
                  }`}
                >
                  {r === "all" ? t("market.all") : RARITY_LABEL[r]}
                </button>
              ))}
            </div>
            {tab === "browse" && (
              <div className="flex gap-1.5">
                {(
                  [
                    ["new", t("market.sort.new")],
                    ["cheap", t("market.sort.cheap")],
                    ["pricey", t("market.sort.pricey")],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSort(id)}
                    className={`rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition ${
                      sort === id ? "border-gram text-gram" : "border-line text-dim"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-3 rounded-xl border border-gram/40 bg-gram/10 px-3 py-2 text-[11px] font-semibold text-gram">
            {notice}
          </div>
        )}
      </div>

      <div className="px-5 pb-32 pt-4">
        {tab === "browse" && (
          <ListingGrid
            listings={others}
            empty={t("market.noListings")}
            action={(l) => ({
              label: t("market.buyFor", { v: l.price }),
              icon: ShoppingCart,
              disabled: player.gram < l.price,
              busy: busy === l.id,
              onClick: () =>
                run(l.id, async () => {
                  const res = await marketBuy({ data: { initData: initData(), id: l.id } });
                  applyServerState(res.state);
                  setNotice(t("market.bought", { name: CARDS_BY_ID[res.cardId]?.name ?? "" }));
                }),
            })}
          />
        )}

        {tab === "swap" && (
          <SwapPanel
            trades={openTrades}
            busy={busy}
            onAccept={(trade, cardId) =>
              run(trade.id, async () => {
                const res = await tradeAccept({
                  data: { initData: initData(), id: trade.id, cardId },
                });
                applyServerState(res.state);
                setNotice(
                  t("market.swapDone", { name: CARDS_BY_ID[res.received]?.name ?? "" }),
                );
              })
            }
          />
        )}

        {tab === "mine" && (
          <div className="space-y-6">
            <section>
              <SectionTitle>{t("market.onSale")}</SectionTitle>
              <ListingGrid
                listings={mine}
                empty={t("market.noneOnSale")}
                action={(l) => ({
                  label: t("market.cancel"),
                  icon: X,
                  disabled: false,
                  busy: busy === l.id,
                  onClick: () =>
                    run(l.id, async () => {
                      const res = await marketCancel({
                        data: { initData: initData(), id: l.id },
                      });
                      applyServerState(res.state);
                      setNotice(t("market.cancelled"));
                    }),
                })}
              />
            </section>
            <section>
              <SectionTitle>{t("market.mySwaps")}</SectionTitle>
              {myTrades.length === 0 ? (
                <Empty>{t("market.noMySwaps")}</Empty>
              ) : (
                <MyTradesList
                  trades={myTrades}
                  busy={busy}
                  onCancel={(tr) =>
                    run(tr.id, async () => {
                      const res = await tradeCancel({
                        data: { initData: initData(), id: tr.id },
                      });
                      applyServerState(res.state);
                      setNotice(t("market.swapCancelled"));
                    })
                  }
                />
              )}
            </section>
          </div>
        )}

        {tab === "sell" && (
          <SellPanel
            busy={busy}
            onSell={(cardId, price) =>
              run("sell", async () => {
                const res = await marketSell({
                  data: { initData: initData(), cardId, price },
                });
                applyServerState(res.state);
                setNotice(t("market.listed"));
                setTab("mine");
              })
            }
            onSwap={(offerCardId, wantCardId) =>
              run("sell", async () => {
                const res = await tradeCreate({
                  data: { initData: initData(), offerCardId, wantCardId },
                });
                applyServerState(res.state);
                setNotice(t("market.swapPublished"));
                setTab("mine");
              })
            }
          />
        )}
        </div>
        {detail && (
          <CardDetailModal
            creature={detail.creature}
            onClose={() => setDetail(null)}
            {...(detail.level !== undefined ? { level: detail.level } : {})}
            {...(detail.qty !== undefined ? { qty: detail.qty } : {})}
          />
        )}
      </AppShell>
    </CardDetailContext.Provider>
  );
}

const PAGE_SIZE = 10;

function usePagination<T>(items: T[], deps: unknown[] = []) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  return { page: safePage, pages, slice, setPage };
}

function Paginator({ page, pages, setPage }: { page: number; pages: number; setPage: (p: number) => void }) {
  const t = useT();
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
        className="grid size-9 place-items-center rounded-xl border border-line bg-panel/70 text-dim disabled:opacity-40"
        aria-label={t("market.prev")}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-[11px] font-bold tabular-nums text-dim">
        {t("market.page", { p: page + 1, n: pages })}
      </span>
      <button
        type="button"
        disabled={page === pages - 1}
        onClick={() => setPage(page + 1)}
        className="grid size-9 place-items-center rounded-xl border border-line bg-panel/70 text-dim disabled:opacity-40"
        aria-label={t("market.next")}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function CardPickGrid({
  cards,
  onPick,
  selectedId,
}: {
  cards: CollectibleCard[];
  onPick: (id: string) => void;
  selectedId?: string | null;
}) {
  const { page, pages, slice, setPage } = usePagination(cards, [cards]);
  const showCard = useCardDetail();
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {slice.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onPick(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(c.id);
              }
            }}
            className={`relative overflow-hidden rounded-xl border bg-panel/70 text-left transition ${
              selectedId === c.id ? "border-gram" : "border-line"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showCard(c);
              }}
              aria-label={`${c.name} info`}
              className="absolute right-1 top-1 z-10 grid size-5 place-items-center rounded-full border border-line bg-panel/90 text-dim"
            >
              <Info className="size-3" />
            </button>
            <div className="aspect-[0.78] w-full">
              <CreatureSigil creature={c} />
            </div>
            <div className="px-1.5 py-1">
              <div className="truncate text-[9px] font-bold">{c.name}</div>
              <div className="text-[8px] font-bold tabular-nums text-dim">
                ATK {c.stats.atk} · DEF {c.stats.def} · SPD {c.stats.spd}
              </div>
              <div className="text-[8px] font-bold tabular-nums text-gram">
                +{c.dailyGram.toFixed(3)} GRAM/d
              </div>
            </div>
          </div>
        ))}
      </div>
      <Paginator page={page} pages={pages} setPage={setPage} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-dim">{children}</h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/60 px-4 py-10 text-center text-[11px] font-semibold text-dim">
      {children}
    </div>
  );
}

function ListingGrid({
  listings,
  empty,
  action,
}: {
  listings: Listing[];
  empty: string;
  action: (l: Listing) => {
    label: string;
    icon: typeof ShoppingCart;
    disabled: boolean;
    busy: boolean;
    onClick: () => void;
  };
}) {
  const { page, pages, slice, setPage } = usePagination(listings, [listings]);
  const showCard = useCardDetail();
  if (!listings.length) return <Empty>{empty}</Empty>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {slice.map((l) => {
          const card = CARDS_BY_ID[l.cardId];
          const a = action(l);
          const Icon = a.icon;
          return (
            <div key={l.id} className="overflow-hidden rounded-2xl border border-line bg-panel/70">
              <button
                type="button"
                onClick={() => card && showCard(card)}
                disabled={!card}
                aria-label={card ? `${card.name}` : l.cardId}
                className="block aspect-[0.78] w-full"
              >
                {card ? <CreatureSigil creature={card} /> : null}
              </button>
              <div className="p-2.5">
                <div className="truncate font-display text-[12px] font-bold">
                  {card?.name ?? l.cardId}
                </div>
                <div className="truncate text-[9px] font-bold uppercase tracking-widest text-dim">
                  {card ? RARITY_LABEL[card.rarity] : ""} · {l.sellerName}
                </div>
                {card ? (
                  <div className="mt-0.5 text-[10px] font-bold text-gram">
                    +{card.dailyGram.toFixed(3)} GRAM/d
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled || a.busy}
                  className="mt-2 h-9 w-full rounded-xl text-[10px] font-bold"
                >
                  {a.busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <Icon className="size-3.5" />
                      {a.label}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Paginator page={page} pages={pages} setPage={setPage} />
    </div>
  );
}

function TradeRowCard({ trade, right }: { trade: Trade; right: React.ReactNode }) {
  const t = useT();
  const showCard = useCardDetail();
  const offer = CARDS_BY_ID[trade.offerCardId];
  const want = trade.wantCardId ? CARDS_BY_ID[trade.wantCardId] : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel/70 p-2.5">
      <button
        type="button"
        onClick={() => offer && showCard(offer)}
        disabled={!offer}
        aria-label={offer ? offer.name : trade.offerCardId}
        className="size-14 shrink-0 overflow-hidden rounded-xl"
      >
        {offer ? <CreatureSigil creature={offer} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[12px] font-bold">
          {offer?.name ?? trade.offerCardId}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-dim">
          <ArrowLeftRight className="size-3" />
          <span className="truncate">
            {want ? want.name : t("market.anyRarity", { rarity: RARITY_LABEL[trade.wantRarity] })}
          </span>
        </div>
        <div className="truncate text-[9px] font-bold uppercase tracking-widest text-dim">
          {RARITY_LABEL[trade.wantRarity]} · {trade.ownerName}
        </div>
      </div>
      {right}
    </div>
  );
}

function MyTradesList({
  trades,
  busy,
  onCancel,
}: {
  trades: Trade[];
  busy: string | null;
  onCancel: (tr: Trade) => void;
}) {
  const t = useT();
  const { page, pages, slice, setPage } = usePagination(trades, [trades]);
  return (
    <div>
      <div className="space-y-2.5">
        {slice.map((tr) => (
          <TradeRowCard
            key={tr.id}
            trade={tr}
            right={
              <Button
                type="button"
                variant="ghost"
                disabled={busy === tr.id}
                onClick={() => onCancel(tr)}
                className="h-8 rounded-xl px-3 text-[10px] font-bold"
              >
                {busy === tr.id ? <Loader2 className="size-3.5 animate-spin" /> : t("market.cancel")}
              </Button>
            }
          />
        ))}
      </div>
      <Paginator page={page} pages={pages} setPage={setPage} />
    </div>
  );
}

function SwapPanel({
  trades,
  busy,
  onAccept,
}: {
  trades: Trade[];
  busy: string | null;
  onAccept: (trade: Trade, cardId: string) => void;
}) {
  const t = useT();
  const player = usePlayer();
  const [openId, setOpenId] = useState<string | null>(null);
  const { page, pages, slice, setPage } = usePagination(trades, [trades]);

  const ownedOf = (rarity: Rarity, exclude: string) =>
    Object.entries(player.owned)
      .filter(([id, e]) => e.qty > 0 && id !== exclude && CARDS_BY_ID[id]?.rarity === rarity)
      .map(([id]) => CARDS_BY_ID[id]!);

  if (!trades.length) return <Empty>{t("market.noSwaps")}</Empty>;

  return (
    <div>
      <div className="space-y-2.5">
        {slice.map((tr) => {
          const candidates = tr.wantCardId
            ? (player.owned[tr.wantCardId]?.qty ?? 0) > 0
              ? [CARDS_BY_ID[tr.wantCardId]!]
              : []
            : ownedOf(tr.wantRarity, tr.offerCardId);
          const isOpen = openId === tr.id;
          return (
            <div key={tr.id}>
              <TradeRowCard
                trade={tr}
                right={
                  <Button
                    type="button"
                    disabled={!candidates.length || busy === tr.id}
                    onClick={() => setOpenId(isOpen ? null : tr.id)}
                    className="h-8 rounded-xl px-3 text-[10px] font-bold"
                  >
                    {busy === tr.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : candidates.length ? (
                      t("market.swap")
                    ) : (
                      t("market.noMatch")
                    )}
                  </Button>
                }
              />
              {isOpen && candidates.length > 0 && (
                <div className="mt-2 rounded-2xl border border-line bg-panel/50 p-2.5">
                  <p className="mb-2 text-[10px] font-semibold text-dim">
                    {t("market.pickGive")}
                  </p>
                  <CardPickGrid
                    cards={candidates}
                    onPick={(id) => {
                      setOpenId(null);
                      onAccept(tr, id);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Paginator page={page} pages={pages} setPage={setPage} />
    </div>
  );
}

function SellPanel({
  busy,
  onSell,
  onSwap,
}: {
  busy: string | null;
  onSell: (cardId: string, price: number) => void;
  onSwap: (offerCardId: string, wantCardId: string | null) => void;
}) {
  const t = useT();
  const player = usePlayer();
  const showCard = useCardDetail();
  const [mode, setMode] = useState<"sell" | "swap">("sell");
  const [cardId, setCardId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [wantCardId, setWantCardId] = useState<string | null>(null);

  const owned = useMemo(
    () =>
      Object.entries(player.owned)
        .filter(([, e]) => e.qty > 0)
        .map(([id, e]) => ({ card: CARDS_BY_ID[id], qty: e.qty }))
        .filter((x) => Boolean(x.card)),
    [player.owned],
  );

  const { page: ownedPage, pages: ownedPages, slice: ownedSlice, setPage: setOwnedPage } =
    usePagination(owned, [owned]);

  const selected = cardId ? CARDS_BY_ID[cardId] : null;
  const lastCopy = !!cardId && (player.owned[cardId]?.qty ?? 0) <= 1;
  const band = selected ? PRICE_BAND[selected.rarity] : null;
  const numericPrice = Number(price);
  const priceOk = !!band && Number.isFinite(numericPrice) && numericPrice >= band.min && numericPrice <= band.max;

  const wantOptions = useMemo(
    () =>
      selected
        ? Object.values(CARDS_BY_ID).filter(
            (c) => c.rarity === selected.rarity && c.id !== selected.id,
          )
        : [],
    [selected],
  );

  if (!owned.length) return <Empty>{t("market.noCards")}</Empty>;

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-panel/70 p-1.5">
        {(
          [
            ["sell", t("market.modeSell")],
            ["swap", t("market.modeSwap")],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant={mode === id ? "default" : "ghost"}
            onClick={() => setMode(id)}
            className="h-9 rounded-xl text-[9px] font-bold uppercase tracking-wider"
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {ownedSlice.map(({ card, qty }) => (
          <div
            key={card!.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              setCardId(card!.id);
              setWantCardId(null);
              setPrice(String(SUGGESTED_PRICE[card!.rarity]));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCardId(card!.id);
                setWantCardId(null);
                setPrice(String(SUGGESTED_PRICE[card!.rarity]));
              }
            }}
            className={`relative overflow-hidden rounded-2xl border bg-panel/70 text-left transition ${
              cardId === card!.id ? "border-gram" : "border-line"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showCard(card!, player.owned[card!.id]?.level, qty);
              }}
              aria-label={`${card!.name} info`}
              className="absolute right-1 top-1 z-10 grid size-5 place-items-center rounded-full border border-line bg-panel/90 text-dim"
            >
              <Info className="size-3" />
            </button>
            <div className="aspect-[0.78] w-full">
              <CreatureSigil creature={card!} />
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[10px] font-bold">{card!.name}</div>
              <div className="text-[9px] font-bold text-dim">
                {RARITY_LABEL[card!.rarity]} · x{qty}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Paginator page={ownedPage} pages={ownedPages} setPage={setOwnedPage} />

      {mode === "sell" ? (
        <div className="mt-4 rounded-2xl border border-line bg-panel/70 p-3">
          <label className="text-[9px] font-bold uppercase tracking-widest text-dim">
            {t("market.price")}
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 focus-within:border-gram">
            <input
              type="number"
              inputMode="decimal"
              min={band?.min ?? 0.01}
              max={band?.max ?? 1000}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-transparent text-base font-extrabold text-ink placeholder:text-dim outline-none"
            />
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-dim">
              GRAM
            </span>
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => setPrice(String(SUGGESTED_PRICE[selected.rarity]))}
              className="mt-2 w-full rounded-xl border border-gram/50 bg-gram/10 px-3 py-2 text-[10px] font-bold text-gram"
            >
              {t("market.useSuggested")} ·{" "}
              {t("market.suggested", { v: SUGGESTED_PRICE[selected.rarity] })}
            </button>
          )}
          <p className="mt-1.5 text-[10px] text-dim">
            {band && selected
              ? t("market.range", {
                  rarity: RARITY_LABEL[selected.rarity],
                  min: band.min,
                  max: band.max,
                })
              : t("market.pickCardFirst")}
          </p>
          <p className="mt-0.5 text-[10px] text-dim">
            {t("market.youReceive", {
              v: (Math.max(0, numericPrice || 0) * (1 - MARKET_FEE)).toFixed(4),
              fee: Math.round(MARKET_FEE * 100),
            })}
          </p>
          {lastCopy && (
            <p className="mt-1 text-[10px] font-semibold text-amber-300">
              {t("market.lastCopyWarn")}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-dim">
            {t("market.expiry", { d: LISTING_TTL_DAYS })}
          </p>
          <Button
            type="button"
            disabled={!cardId || busy === "sell" || !priceOk}
            onClick={() => cardId && onSell(cardId, numericPrice)}
            className="mt-3 h-11 w-full rounded-xl font-bold"
          >
            {busy === "sell" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Tag className="size-4" />
            )}
            {t("market.listCard")}
          </Button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-line bg-panel/70 p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-dim">
            {t("market.wantCard")}
          </p>
          <p className="mt-1 text-[10px] text-dim">{t("market.sameRarity")}</p>
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => setWantCardId(null)}
                className={`mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                  wantCardId === null ? "border-gram text-gram" : "border-line text-dim"
                }`}
              >
                {wantCardId === null && <Check className="size-3.5" />}
                {t("market.anyCard", { rarity: RARITY_LABEL[selected.rarity] })}
              </button>
              <div className="mt-2">
                <CardPickGrid
                  cards={wantOptions}
                  selectedId={wantCardId}
                  onPick={(id) => setWantCardId(id)}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-[10px] text-dim">{t("market.pickOfferFirst")}</p>
          )}
          <Button
            type="button"
            disabled={!cardId || busy === "sell"}
            onClick={() => cardId && onSwap(cardId, wantCardId)}
            className="mt-3 h-11 w-full rounded-xl font-bold"
          >
            {busy === "sell" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="size-4" />
            )}
            {t("market.publishSwap")}
          </Button>
        </div>
      )}
    </div>
  );
}

function CardDetailModal({
  creature,
  level,
  qty,
  onClose,
}: {
  creature: CollectibleCard;
  level?: number;
  qty?: number;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-[100] mx-auto flex max-w-[520px] items-start justify-center overflow-y-auto bg-dark/70 px-5 pb-7 pt-[max(env(safe-area-inset-top),56px)] backdrop-blur-md"
      onClick={onClose}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={t("common.close")}
        onClick={onClose}
        className="fixed right-4 top-4 z-[110] rounded-full border border-panel/50 bg-panel/90 shadow-lg"
      >
        <X />
      </Button>
      <div
        className="flex w-full max-w-[330px] flex-col items-center anim-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-[0.7] w-[min(76vw,290px)]">
          <CreatureCard creature={creature} level={level ?? 1} qty={qty} size="detail" />
        </div>
        <Button
          variant="secondary"
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-2xl font-display font-bold uppercase"
        >
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}

function ComingSoon() {
  const t = useT();
  return (
    <AppShell>
      <div className="flex flex-col items-center px-6 pb-32 pt-16 text-center">
        <div className="grid size-20 place-items-center rounded-3xl border border-line bg-panel/70">
          <Lock className="size-8 text-gram" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight">
          {t("market.soon")}
        </h1>
        <p className="mt-2 max-w-[280px] text-[12px] leading-relaxed text-dim">
          {t("market.soonText")}
        </p>
      </div>
    </AppShell>
  );
}
