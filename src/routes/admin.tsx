import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  BarChart3,
  Check,
  ListChecks,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Store,
  Share2,
  Fingerprint,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { initData } from "@/lib/telegram";
import {
  adminAdjustGram,
  adminBroadcast,
  adminCheck,
  adminDeleteTask,
  adminMovements,
  adminMultiAccounts,
  adminOverview,
  adminPlayers,
  adminSaveTask,
  adminMarketWatch,
  adminReferrers,
  adminSetBanned,
  adminTasks,
  type AdminReferrer,
  type AdminIpGroup,
  type AdminMovement,
  type AdminOverview,
  type AdminPlayer,
  type AdminTask,
  type MarketPair,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Monsters Cards" },
      { name: "description", content: "Private administration panel for Monsters Cards operators." },
      { property: "og:title", content: "Admin — Monsters Cards" },
      { property: "og:description", content: "Private administration panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab =
  | "overview"
  | "tasks"
  | "players"
  | "referrals"
  | "multi"
  | "market"
  | "money"
  | "broadcast";

const TABS: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "players", label: "Players", icon: Users },
  { id: "referrals", label: "Referrals", icon: Share2 },
  { id: "multi", label: "Multi-account", icon: Fingerprint },
  { id: "market", label: "Market watch", icon: Store },
  { id: "money", label: "Money", icon: Wallet },
  { id: "broadcast", label: "Broadcast", icon: Megaphone },
];

const EMPTY_TASK = {
  id: null as string | null,
  kind: "channel" as AdminTask["kind"],
  title: "",
  description: "",
  url: "",
  chatRef: "",
  reward: 0.1,
  waitSeconds: 15,
  active: true,
  sortOrder: 0,
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="soft-card rounded-2xl p-3">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="font-display text-lg font-extrabold">{value}</div>
      <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-dim">{label}</div>
    </Card>
  );
}

const input =
  "w-full rounded-xl bg-panel2 px-3 py-2.5 text-[11px] font-semibold outline-none placeholder:text-dim";
const button =
  "flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-dark px-3 text-[10px] font-extrabold uppercase tracking-wider text-white transition-transform active:scale-95 disabled:opacity-50";

function AdminPage() {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    adminCheck({ data: { initData: initData() } })
      .then((r) => setStatus(r.isAdmin ? "allowed" : "denied"))
      .catch(() => setStatus("denied"));
  }, []);

  if (status !== "allowed") {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center px-6 text-center">
          {status === "checking" ? (
            <Loader2 className="animate-spin text-dim" aria-hidden="true" />
          ) : (
            <div>
              <h1 className="font-display text-lg font-extrabold">Restricted area</h1>
              <p className="mt-2 text-[11px] text-dim">
                This panel is only available to the game administrator inside Telegram.
              </p>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 pt-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-dim">Monsters Cards</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight">
          Admin panel
        </h1>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setError("");
              }}
              className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                active ? "bg-dark text-white" : "bg-panel2 text-dim"
              }`}
            >
              <Icon size={13} aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="px-5 pt-3 text-[10px] font-bold text-legend">{error}</p> : null}

      <div className="px-5 pt-4">
        {tab === "overview" ? <OverviewTab onError={setError} /> : null}
        {tab === "tasks" ? <TasksTab onError={setError} /> : null}
        {tab === "players" ? <PlayersTab onError={setError} /> : null}
        {tab === "referrals" ? <ReferralsTab onError={setError} /> : null}
        {tab === "multi" ? <MultiTab onError={setError} /> : null}
        {tab === "market" ? <MarketWatchTab onError={setError} /> : null}
        {tab === "money" ? <MoneyTab onError={setError} /> : null}
        {tab === "broadcast" ? <BroadcastTab onError={setError} /> : null}
      </div>
    </AppShell>
  );
}

function OverviewTab({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    adminOverview({ data: { initData: initData() } })
      .then(setData)
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load stats"));
  }, [onError]);

  if (!data) return <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Players" value={data.players} />
      <Stat label="New (24h)" value={data.newToday} />
      <Stat label="GRAM in wallets" value={data.gramCirculating.toFixed(2)} />
      <Stat label="Packs opened" value={data.packsOpened} />
      <Stat label="Deposits" value={`${data.deposits.count} · ${data.deposits.total.toFixed(2)}`} />
      <Stat
        label="Withdrawals"
        value={`${data.withdrawals.count} · ${data.withdrawals.total.toFixed(2)}`}
      />
      <Stat label="Withdrawals pending" value={data.withdrawals.pending} />
      <Stat label="Withdrawals failed (refunded)" value={data.withdrawals.failed} />
      <Stat label="Active tasks" value={data.activeTasks} />
      <Stat label="Banned" value={data.banned} />
    </div>
  );
}

function TasksTab({ onError }: { onError: (m: string) => void }) {
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    adminTasks({ data: { initData: initData() } })
      .then(setTasks)
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load tasks"));
  }, [onError]);

  useEffect(reload, [reload]);

  const save = async () => {
    setSaving(true);
    onError("");
    try {
      await adminSaveTask({
        data: {
          initData: initData(),
          id: form.id,
          kind: form.kind,
          title: form.title,
          description: form.description,
          url: form.url,
          chatRef: form.chatRef,
          reward: Number(form.reward),
          waitSeconds: Number(form.waitSeconds),
          active: form.active,
          sortOrder: Number(form.sortOrder),
        },
      });
      setForm(EMPTY_TASK);
      reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save the task");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await adminDeleteTask({ data: { initData: initData(), id } });
      reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete the task");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-sm font-extrabold">
          {form.id ? "Edit task" : "New task"}
        </h2>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["channel", "group", "bot"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind }))}
              className={`min-h-9 rounded-xl text-[10px] font-extrabold uppercase tracking-wider ${
                form.kind === kind ? "bg-dark text-white" : "bg-panel2 text-dim"
              }`}
            >
              {kind}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-2">
          <input
            className={input}
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            className={input}
            placeholder="Short description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input
            className={input}
            placeholder="Link (https://t.me/...)"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          />
          {form.kind === "bot" ? (
            <input
              className={input}
              type="number"
              min={0}
              placeholder="Seconds to wait"
              value={form.waitSeconds}
              onChange={(e) => setForm((f) => ({ ...f, waitSeconds: Number(e.target.value) }))}
            />
          ) : (
            <input
              className={input}
              placeholder="@channelusername or -100123456789"
              value={form.chatRef}
              onChange={(e) => setForm((f) => ({ ...f, chatRef: e.target.value }))}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              className={input}
              type="number"
              step="0.01"
              min={0}
              placeholder="Reward in GRAM"
              value={form.reward}
              onChange={(e) => setForm((f) => ({ ...f, reward: Number(e.target.value) }))}
            />
            <input
              className={input}
              type="number"
              placeholder="Order"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
          </div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-dim">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Visible to players
          </label>
        </div>

        {form.kind !== "bot" ? (
          <p className="mt-2 text-[9px] leading-snug text-dim">
            The bot must be an administrator of that channel/group to verify memberships.
          </p>
        ) : (
          <p className="mt-2 text-[9px] leading-snug text-dim">
            Players open the bot and can claim after the waiting time.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={`${button} flex-1`}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={13} aria-hidden="true" />
            )}
            {form.id ? "Save changes" : "Create task"}
          </button>
          {form.id ? (
            <button
              type="button"
              className={`${button} bg-panel2 text-dim`}
              onClick={() => setForm(EMPTY_TASK)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </Card>

      {!tasks ? (
        <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />
      ) : tasks.length === 0 ? (
        <p className="text-center text-[11px] text-dim">No tasks created yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-panel2 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-rare">
                      {task.kind}
                    </span>
                    {!task.active ? (
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-dim">
                        hidden
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-1 truncate font-display text-sm font-extrabold">
                    {task.title}
                  </h3>
                  <p className="truncate text-[10px] text-dim">{task.url}</p>
                  <p className="mt-0.5 text-[9px] text-dim">{task.completions} completed</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-sm font-extrabold text-gram">
                    +{task.reward.toFixed(2)}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      aria-label="Edit"
                      className="grid size-8 place-items-center rounded-lg bg-panel2 text-dim"
                      onClick={() =>
                        setForm({
                          id: task.id,
                          kind: task.kind,
                          title: task.title,
                          description: task.description,
                          url: task.url,
                          chatRef: task.chatRef ?? "",
                          reward: task.reward,
                          waitSeconds: task.waitSeconds,
                          active: task.active,
                          sortOrder: task.sortOrder,
                        })
                      }
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      className="grid size-8 place-items-center rounded-lg bg-panel2 text-legend"
                      onClick={() => void remove(task.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayersTab({ onError }: { onError: (m: string) => void }) {
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const reload = useCallback(
    (term: string) => {
      adminPlayers({ data: { initData: initData(), search: term } })
        .then(setPlayers)
        .catch((e) => onError(e instanceof Error ? e.message : "Could not load players"));
    },
    [onError],
  );

  useEffect(() => reload(""), [reload]);

  const adjust = async (telegramId: number) => {
    const value = Number(amounts[telegramId]);
    if (!Number.isFinite(value) || value === 0) return;
    try {
      await adminAdjustGram({ data: { initData: initData(), telegramId, amount: value } });
      setAmounts((a) => ({ ...a, [telegramId]: "" }));
      reload(search);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not adjust the balance");
    }
  };

  const toggleBan = async (player: AdminPlayer) => {
    try {
      await adminSetBanned({
        data: { initData: initData(), telegramId: player.telegramId, banned: !player.banned },
      });
      reload(search);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not update the player");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className={input}
          placeholder="Telegram ID or username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className={button} onClick={() => reload(search)}>
          <Search size={13} aria-hidden="true" />
        </button>
      </div>

      {!players ? (
        <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />
      ) : players.length === 0 ? (
        <p className="text-center text-[11px] text-dim">No players found.</p>
      ) : (
        players.map((p) => (
          <Card key={p.telegramId}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-sm font-extrabold">
                  {p.firstName ?? "Player"}{" "}
                  {p.username ? <span className="text-dim">@{p.username}</span> : null}
                </h3>
                <p className="text-[9px] text-dim">
                  ID {p.telegramId} · {p.cards} cards · {p.packsOpened} packs
                  {p.referredBy ? ` · ref ${p.referredBy}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-sm font-extrabold text-gram">
                  {p.gram.toFixed(2)}
                </div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-dim">GRAM</div>
              </div>
            </div>

            <div className="mt-2 flex gap-2">
              <input
                className={input}
                type="number"
                step="0.01"
                placeholder="+/- GRAM"
                value={amounts[p.telegramId] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [p.telegramId]: e.target.value }))}
              />
              <button type="button" className={button} onClick={() => void adjust(p.telegramId)}>
                <Check size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={p.banned ? "Unban" : "Ban"}
                className={`${button} ${p.banned ? "bg-legend" : "bg-panel2 text-dim"}`}
                onClick={() => void toggleBan(p)}
              >
                <Ban size={13} aria-hidden="true" />
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function MoneyTab({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<{
    deposits: AdminMovement[];
    withdrawals: AdminMovement[];
  } | null>(null);

  useEffect(() => {
    adminMovements({ data: { initData: initData() } })
      .then(setData)
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load movements"));
  }, [onError]);

  if (!data) return <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />;

  const row = (m: AdminMovement, kind: "in" | "out") => (
    <Card key={m.id}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-extrabold">ID {m.telegramId}</p>
          <p className="text-[9px] text-dim">
            {new Date(m.at).toLocaleString()} {m.status ? `· ${m.status}` : ""}
          </p>
        </div>
        <div
          className={`shrink-0 font-display text-sm font-extrabold ${kind === "in" ? "text-gram" : "text-legend"}`}
        >
          {kind === "in" ? "+" : "−"}
          {m.amount.toFixed(2)}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-dim">
          Deposits
        </h2>
        <div className="mt-2 space-y-2">
          {data.deposits.length ? (
            data.deposits.map((d) => row(d, "in"))
          ) : (
            <p className="text-[11px] text-dim">None yet.</p>
          )}
        </div>
      </section>
      <section>
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-dim">
          Withdrawals
        </h2>
        <div className="mt-2 space-y-2">
          {data.withdrawals.length ? (
            data.withdrawals.map((w) => row(w, "out"))
          ) : (
            <p className="text-[11px] text-dim">None yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function BroadcastTab({ onError }: { onError: (m: string) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  const send = async () => {
    setSending(true);
    setSent(null);
    onError("");
    try {
      const res = await adminBroadcast({ data: { initData: initData(), text } });
      setSent(res.sent);
      setText("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not send the broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-sm font-extrabold">Message all players</h2>
      <textarea
        className={`${input} mt-2 min-h-32`}
        placeholder="Your message (HTML allowed)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className={`${button} mt-2 w-full`}
        disabled={sending || !text.trim()}
        onClick={() => void send()}
      >
        {sending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <Megaphone size={13} aria-hidden="true" />
        )}
        Send broadcast
      </button>
      {sent !== null ? (
        <p className="mt-2 text-[10px] font-bold text-gram">Sent to {sent} players.</p>
      ) : null}
    </Card>
  );
}

function MarketWatchTab({ onError }: { onError: (m: string) => void }) {
  const [pairs, setPairs] = useState<MarketPair[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    adminMarketWatch({ data: { initData: initData() } })
      .then(setPairs)
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load market watch"));
  }, [onError]);

  const setBan = useCallback(
    async (key: string, ids: number[], banned: boolean) => {
      setBusy(key);
      try {
        for (const telegramId of ids) {
          await adminSetBanned({ data: { initData: initData(), telegramId, banned } });
        }
        setPairs((prev) =>
          (prev ?? []).map((p) => ({
            ...p,
            a: ids.includes(p.a.telegramId) ? { ...p.a, banned } : p.a,
            b: ids.includes(p.b.telegramId) ? { ...p.b, banned } : p.b,
          })),
        );
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not update these accounts");
      } finally {
        setBusy(null);
      }
    },
    [onError],
  );

  if (!pairs) return <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />;
  if (!pairs.length)
    return (
      <p className="text-[11px] text-dim">
        No repeated deals between the same two accounts. Pairs that close 2+ sales or swaps
        with each other show up here.
      </p>
    );

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-dim">
        Accounts that keep dealing with each other. Repeated deals between the same two players
        are the usual signature of a farm moving cards and GRAM internally.
      </p>
      {pairs.map((p) => {
        const key = `${p.a.telegramId}:${p.b.telegramId}`;
        const ids = [p.a.telegramId, p.b.telegramId];
        const bothBanned = p.a.banned && p.b.banned;
        return (
          <div key={key} className="rounded-2xl border border-line bg-panel/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold">
                  {p.a.name} {p.a.banned ? "🚫" : ""} ↔ {p.b.name} {p.b.banned ? "🚫" : ""}
                </p>
                <p className="mt-0.5 text-[10px] text-dim">
                  {p.sales} sales · {p.swaps} swaps · {p.gram} GRAM moved · last{" "}
                  {p.lastAt ? new Date(p.lastAt).toLocaleDateString() : "—"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === key}
                onClick={() => setBan(key, ids, !bothBanned)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  bothBanned ? "bg-panel2 text-dim" : "bg-legend/20 text-legend"
                }`}
              >
                {busy === key ? "…" : bothBanned ? "Unban both" : "Ban both"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type MultiFilter = "farms" | "banned" | "all";

function MultiTab({ onError }: { onError: (m: string) => void }) {
  const [groups, setGroups] = useState<AdminIpGroup[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<MultiFilter>("farms");
  const [page, setPage] = useState(0);

  useEffect(() => {
    adminMultiAccounts({ data: { initData: initData() } })
      .then(setGroups)
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load multi-account data"));
  }, [onError]);

  const apply = useCallback(
    async (key: string, ids: number[], banned: boolean) => {
      setBusy(key);
      try {
        for (const telegramId of ids) {
          await adminSetBanned({ data: { initData: initData(), telegramId, banned } });
        }
        setGroups((prev) =>
          (prev ?? []).map((g) => ({
            ...g,
            accounts: g.accounts.map((a) => (ids.includes(a.telegramId) ? { ...a, banned } : a)),
          })),
        );
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not update these accounts");
      } finally {
        setBusy(null);
      }
    },
    [onError],
  );

  if (!groups) return <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />;
  if (!groups.length)
    return <p className="text-[11px] text-dim">No shared network addresses detected yet.</p>;

  const filtered = groups.filter((g) =>
    filter === "farms" ? g.flagged >= 2 : filter === "banned" ? g.bannedCount > 0 : true,
  );
  const perPage = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * perPage, current * perPage + perPage);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-dim">
        Networks with more than one account, with the farming signals each account shows. Up to 3
        accounts on one network is tolerated; farms are suspended automatically.
      </p>

      <div className="flex gap-1">
        {(
          [
            ["farms", `Farms (${groups.filter((g) => g.flagged >= 2).length})`],
            ["banned", `With blocked (${groups.filter((g) => g.bannedCount > 0).length})`],
            ["all", `All (${groups.length})`],
          ] as Array<[MultiFilter, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setFilter(id);
              setPage(0);
            }}
            className={`flex-1 rounded-lg px-2 py-1 text-[9px] font-extrabold uppercase ${
              filter === id ? "bg-legend text-white" : "bg-panel2 text-dim"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!shown.length ? (
        <p className="text-[11px] text-dim">Nothing to review in this view.</p>
      ) : null}

      {shown.map((g) => {
        const active = g.accounts.filter((a) => !a.banned).map((a) => a.telegramId);
        const banned = g.accounts.filter((a) => a.banned).map((a) => a.telegramId);
        return (
          <Card key={g.ip}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px] font-bold">{g.ip}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                  g.flagged >= 2 ? "bg-legend text-white" : "bg-panel2 text-dim"
                }`}
              >
                {g.accounts.length} accounts
              </span>
            </div>
            <p className="mt-1 text-[9px] text-dim">
              {g.activeCount} active · {g.bannedCount} blocked · {g.flagged} with multiple signals
            </p>


            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={`${button} flex-1 justify-center`}
                disabled={busy !== null || !active.length}
                onClick={() => void apply(`${g.ip}:ban`, active, true)}
              >
                {busy === `${g.ip}:ban` ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Ban size={12} aria-hidden="true" />
                )}
                Ban group ({active.length})
              </button>
              <button
                type="button"
                className={`${button} flex-1 justify-center`}
                disabled={busy !== null || !banned.length}
                onClick={() => void apply(`${g.ip}:unban`, banned, false)}
              >
                {busy === `${g.ip}:unban` ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check size={12} aria-hidden="true" />
                )}
                Unban group ({banned.length})
              </button>
            </div>

            <ul className="mt-2 space-y-2">
              {g.accounts.map((a) => (
                <li key={a.telegramId} className="rounded-lg bg-panel2 p-2 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {a.username ? `@${a.username}` : (a.firstName ?? "Collector")}{" "}
                      <span className="text-dim">#{a.telegramId}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={a.banned ? "font-extrabold text-legend" : "text-dim"}>
                        {a.banned ? "Banned" : "Active"}
                      </span>
                      <button
                        type="button"
                        className={button}
                        disabled={busy !== null}
                        onClick={() =>
                          void apply(`${g.ip}:${a.telegramId}`, [a.telegramId], !a.banned)
                        }
                      >
                        {busy === `${g.ip}:${a.telegramId}` ? (
                          <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                        ) : a.banned ? (
                          <Check size={11} aria-hidden="true" />
                        ) : (
                          <Ban size={11} aria-hidden="true" />
                        )}
                        {a.banned ? "Unban" : "Ban"}
                      </button>
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-dim">
                    {a.deposits} deposits ({a.depositTotal} GRAM) · {a.withdrawn} withdrawn ·{" "}
                    {a.packs} packs · {a.cards} cards · {a.gram} GRAM
                  </p>
                  {a.signals.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.signals.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-panel px-2 py-0.5 text-[8px] font-bold uppercase text-legend"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[9px] text-dim">No farming signals.</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={button}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Prev
          </button>
          <span className="text-[10px] text-dim">
            {current + 1}/{pages}
          </span>
          <button
            type="button"
            className={button}
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReferralsTab({ onError }: { onError: (m: string) => void }) {
  const [rows, setRows] = useState<AdminReferrer[] | null>(null);
  const [sort, setSort] = useState<"qualified" | "total" | "earned" | "deposits">("qualified");

  useEffect(() => {
    adminReferrers({ data: { initData: initData() } })
      .then(setRows)
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load referrers"));
  }, [onError]);

  if (!rows) return <Loader2 className="mx-auto animate-spin text-dim" aria-hidden="true" />;
  if (!rows.length) return <p className="text-[11px] text-dim">No referrers yet.</p>;

  const sorted = [...rows].sort((a, b) =>
    sort === "total"
      ? b.total - a.total
      : sort === "earned"
        ? b.earned - a.earned
        : sort === "deposits"
          ? b.depositedByNetwork - a.depositedByNetwork
          : b.qualified - a.qualified,
  );

  const totals = rows.reduce(
    (acc, r) => ({
      invited: acc.invited + r.l1,
      qualified: acc.qualified + r.qualified,
      earned: acc.earned + r.earned,
      deposits: acc.deposits + r.depositedByNetwork,
    }),
    { invited: 0, qualified: 0, earned: 0, deposits: 0 },
  );

  const SORTS: Array<{ id: typeof sort; label: string }> = [
    { id: "qualified", label: "Qualified" },
    { id: "total", label: "Network" },
    { id: "earned", label: "Commission" },
    { id: "deposits", label: "Deposits" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Direct invites" value={totals.invited} />
        <Stat label="Qualified (opened a pack)" value={totals.qualified} />
        <Stat label="Commission paid" value={`${totals.earned.toFixed(2)} GRAM`} />
        <Stat label="Deposited by networks" value={totals.deposits.toFixed(2)} />
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
              sort === s.id ? "bg-dark text-white" : "bg-panel2 text-dim"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((r, i) => (
          <div
            key={r.telegramId}
            className="rounded-2xl border border-line bg-panel/70 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[12px] font-bold">
                <span className="text-dim">#{i + 1}</span> {r.name} {r.banned ? "🚫" : ""}
              </p>
              <span className="shrink-0 rounded-full bg-gram/15 px-2 py-1 text-[10px] font-extrabold text-gram">
                {r.earned.toFixed(4)} GRAM
              </span>
            </div>
            <p className="mt-1 text-[10px] text-dim">
              L1 {r.l1} · L2 {r.l2} · L3 {r.l3} · network {r.total} · qualified {r.qualified}
            </p>
            <p className="mt-0.5 text-[10px] text-dim">
              Network deposits {r.depositedByNetwork.toFixed(2)} TON · packs {r.packsByNetwork} ·
              ID {r.telegramId}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
