import { createServerFn } from "@tanstack/react-start";

/** Admin panel back end. Only the hard-coded admin Telegram ID may call these. */

export const ADMIN_TELEGRAM_ID = 6334940213;

type Input = { initData: string };

function requireInitData<T extends Input>(input: T) {
  if (!input || typeof input.initData !== "string" || input.initData.length < 10) {
    throw new Error("Missing Telegram session");
  }
  return input;
}

async function adminCtx(initData: string) {
  const { verifyInitData } = await import("./telegram.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const user = await verifyInitData(initData);
  if (user.id !== ADMIN_TELEGRAM_ID) throw new Error("Not authorised");
  return { user, supabaseAdmin };
}

export const adminCheck = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }) => {
    const { verifyInitData } = await import("./telegram.server");
    const user = await verifyInitData(data.initData);
    return { isAdmin: user.id === ADMIN_TELEGRAM_ID };
  });

export type AdminOverview = {
  players: number;
  newToday: number;
  banned: number;
  gramCirculating: number;
  packsOpened: number;
  deposits: { count: number; total: number };
  withdrawals: { count: number; total: number; pending: number; failed: number };
  activeTasks: number;
};

export const adminOverview = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }): Promise<AdminOverview> => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const since = new Date(Date.now() - 86400000).toISOString();

    const [players, newToday, banned, tasks, deposits, withdrawals, states] = await Promise.all([
      supabaseAdmin.from("players").select("telegram_id", { count: "exact", head: true }),
      supabaseAdmin
        .from("players")
        .select("telegram_id", { count: "exact", head: true })
        .gte("created_at", since),
      supabaseAdmin
        .from("players")
        .select("telegram_id", { count: "exact", head: true })
        .eq("banned", true),
      supabaseAdmin
        .from("custom_tasks")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabaseAdmin.from("ton_deposits").select("amount"),
      supabaseAdmin.from("withdrawals").select("amount, status"),
      supabaseAdmin.from("players").select("state"),
    ]);

    let gram = 0;
    let packs = 0;
    for (const row of states.data ?? []) {
      const s = (row.state ?? {}) as { gram?: number; packsOpened?: number };
      gram += Number(s.gram ?? 0) || 0;
      packs += Number(s.packsOpened ?? 0) || 0;
    }

    const dep = deposits.data ?? [];
    const wds = withdrawals.data ?? [];

    return {
      players: players.count ?? 0,
      newToday: newToday.count ?? 0,
      banned: banned.count ?? 0,
      gramCirculating: Math.round(gram * 100) / 100,
      packsOpened: packs,
      deposits: {
        count: dep.length,
        total:
          Math.round(dep.reduce((a: number, d: any) => a + Number(d.amount || 0), 0) * 100) / 100,
      },
      withdrawals: {
        count: wds.filter((w: any) => w.status === "sent").length,
        total:
          Math.round(
            wds
              .filter((w: any) => w.status === "sent")
              .reduce((a: number, w: any) => a + Number(w.amount || 0), 0) * 100,
          ) / 100,
        // Only payouts still in flight count as pending; failed ones were refunded.
        pending: wds.filter(
          (w: any) => w.status === "pending" || w.status === "sending" || w.status === "review",
        ).length,
        failed: wds.filter((w: any) => w.status === "failed").length,
      },
      activeTasks: tasks.count ?? 0,
    };
  });

export type AdminPlayer = {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  gram: number;
  packsOpened: number;
  cards: number;
  referredBy: number | null;
  banned: boolean;
  createdAt: string;
};

export const adminPlayers = createServerFn({ method: "POST" })
  .inputValidator((input: Input & { search?: string }) => requireInitData(input))
  .handler(async ({ data }): Promise<AdminPlayer[]> => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    let query = supabaseAdmin
      .from("players")
      .select("telegram_id, username, first_name, state, referred_by, banned, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const search = (data.search ?? "").trim();
    if (search) {
      const numeric = Number(search);
      query =
        Number.isFinite(numeric) && search.match(/^\d+$/)
          ? query.eq("telegram_id", numeric)
          : query.ilike("username", `%${search.replace("@", "")}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => {
      const s = (r.state ?? {}) as { gram?: number; packsOpened?: number; owned?: object };
      return {
        telegramId: Number(r.telegram_id),
        username: r.username ?? null,
        firstName: r.first_name ?? null,
        gram: Math.round((Number(s.gram ?? 0) || 0) * 100) / 100,
        packsOpened: Number(s.packsOpened ?? 0) || 0,
        cards: Object.keys(s.owned ?? {}).length,
        referredBy: r.referred_by ?? null,
        banned: Boolean(r.banned),
        createdAt: r.created_at as string,
      };
    });
  });

export const adminAdjustGram = createServerFn({ method: "POST" })
  .inputValidator((input: Input & { telegramId: number; amount: number; note?: string }) => {
    requireInitData(input);
    if (!Number.isFinite(input.telegramId) || !Number.isFinite(input.amount))
      throw new Error("Invalid input");
    if (Math.abs(input.amount) > 100000) throw new Error("Amount out of range");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const { creditGram } = await import("./referrals.server");
    // Balance-only movement: an admin adjustment must not overwrite whatever
    // the player is doing in the app at that moment.
    const saved = await creditGram(supabaseAdmin, data.telegramId, data.amount);

    const { notifyUser } = await import("./telegram.server");
    await notifyUser(
      data.telegramId,
      (data.amount >= 0
        ? `🎉 <b>Balance credited</b>\n+${data.amount.toFixed(2)} GRAM\nNew balance: <b>${saved.gram.toFixed(2)} GRAM</b>`
        : `ℹ️ <b>Balance adjusted</b>\n${data.amount.toFixed(2)} GRAM\nNew balance: <b>${saved.gram.toFixed(2)} GRAM</b>`) +
        (data.note?.trim() ? `\n\n${data.note.trim().slice(0, 200)}` : ""),
    );
    return { gram: saved.gram };
  });

export const adminSetBanned = createServerFn({ method: "POST" })
  .inputValidator((input: Input & { telegramId: number; banned: boolean }) => {
    requireInitData(input);
    if (!Number.isFinite(input.telegramId)) throw new Error("Invalid player");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const { error } = await supabaseAdmin
      .from("players")
      .update({ banned: data.banned, ban_reason: data.banned ? "admin" : null })
      .eq("telegram_id", data.telegramId);
    if (error) throw new Error(error.message);
    return { banned: data.banned };
  });

export type AdminTask = {
  id: string;
  kind: "channel" | "group" | "bot";
  title: string;
  description: string;
  url: string;
  chatRef: string | null;
  reward: number;
  waitSeconds: number;
  active: boolean;
  sortOrder: number;
  completions: number;
};

export const adminTasks = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }): Promise<AdminTask[]> => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const { data: rows } = await supabaseAdmin
      .from("custom_tasks")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const { data: done } = await supabaseAdmin
      .from("custom_task_progress")
      .select("task_id")
      .not("claimed_at", "is", null);

    const counts = new Map<string, number>();
    for (const row of done ?? []) {
      const id = row.task_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      kind: r.kind as AdminTask["kind"],
      title: r.title as string,
      description: (r.description as string) ?? "",
      url: r.url as string,
      chatRef: (r.chat_ref as string | null) ?? null,
      reward: Number(r.reward),
      waitSeconds: Number(r.wait_seconds),
      active: Boolean(r.active),
      sortOrder: Number(r.sort_order),
      completions: counts.get(r.id as string) ?? 0,
    }));
  });

export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator(
    (
      input: Input & {
        id?: string | null;
        kind: "channel" | "group" | "bot";
        title: string;
        description?: string;
        url: string;
        chatRef?: string | null;
        reward: number;
        waitSeconds?: number;
        active?: boolean;
        sortOrder?: number;
      },
    ) => {
      requireInitData(input);
      if (!["channel", "group", "bot"].includes(input.kind)) throw new Error("Invalid task type");
      if (!input.title?.trim()) throw new Error("Title is required");
      if (!/^https?:\/\//i.test(input.url ?? "")) throw new Error("Link must start with https://");
      if (!Number.isFinite(input.reward) || input.reward < 0 || input.reward > 1000) {
        throw new Error("Invalid reward");
      }
      if (input.kind !== "bot" && !input.chatRef?.trim()) {
        throw new Error("Channel/group tasks need the @username or chat ID");
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    if (data.kind !== "bot") {
      // Membership checks only work where the bot is an admin of the chat.
      const { botApi } = await import("./telegram.server");
      const me = (await botApi("getMe", {})) as { result?: { id?: number } };
      const res = (await botApi("getChatMember", {
        chat_id: (data.chatRef ?? "").trim(),
        user_id: me.result?.id ?? 0,
      })) as { ok: boolean; result?: { status?: string } };
      if (!res.ok || !["administrator", "creator"].includes(res.result?.status ?? "")) {
        throw new Error("Add the bot as admin of that channel/group first, so it can verify members");
      }
    }
    const row = {
      kind: data.kind,
      title: data.title.trim().slice(0, 120),
      description: (data.description ?? "").trim().slice(0, 300),
      url: data.url.trim(),
      chat_ref: data.kind === "bot" ? null : (data.chatRef ?? "").trim(),
      reward: Math.round(data.reward * 10000) / 10000,
      wait_seconds: Math.max(0, Math.min(600, Math.round(data.waitSeconds ?? 15))),
      active: data.active ?? true,
      sort_order: Math.round(data.sortOrder ?? 0),
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("custom_tasks").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("custom_tasks")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((input: Input & { id: string }) => {
    requireInitData(input);
    if (!input.id) throw new Error("Unknown task");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const { error } = await supabaseAdmin.from("custom_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type AdminMovement = {
  id: string;
  telegramId: number;
  amount: number;
  net?: number;
  status?: string;
  hash: string | null;
  at: string;
};

export const adminMovements = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
      supabaseAdmin
        .from("ton_deposits")
        .select("id, telegram_id, amount, tx_hash, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("withdrawals")
        .select("id, telegram_id, amount, net, status, tx_hash, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      deposits: (deposits ?? []).map((d: any) => ({
        id: d.id as string,
        telegramId: Number(d.telegram_id),
        amount: Number(d.amount),
        hash: (d.tx_hash as string | null) ?? null,
        at: d.created_at as string,
      })) as AdminMovement[],
      withdrawals: (withdrawals ?? []).map((w: any) => ({
        id: w.id as string,
        telegramId: Number(w.telegram_id),
        amount: Number(w.amount),
        net: Number(w.net),
        status: w.status as string,
        hash: (w.tx_hash as string | null) ?? null,
        at: w.created_at as string,
      })) as AdminMovement[],
    };
  });

/* ------------------------------------------------------------------ *
 * Referral leaderboard
 * ------------------------------------------------------------------ */

export type AdminReferrer = {
  telegramId: number;
  name: string;
  banned: boolean;
  l1: number;
  l2: number;
  l3: number;
  total: number;
  qualified: number;
  earned: number;
  depositedByNetwork: number;
  packsByNetwork: number;
  joinedAt: string;
};

export const adminReferrers = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }): Promise<AdminReferrer[]> => {
    const { supabaseAdmin } = await adminCtx(data.initData);

    const [{ data: rows }, { data: deposits }] = await Promise.all([
      supabaseAdmin
        .from("players")
        .select("telegram_id, username, first_name, referred_by, banned, state, created_at")
        .limit(20000),
      supabaseAdmin.from("ton_deposits").select("telegram_id, amount").limit(20000),
    ]);

    type P = {
      id: number;
      name: string;
      banned: boolean;
      parent: number | null;
      packs: number;
      earned: number;
      joinedAt: string;
    };

    const players = new Map<number, P>();
    const children = new Map<number, number[]>();

    for (const r of rows ?? []) {
      const id = Number((r as any).telegram_id);
      const s = ((r as any).state ?? {}) as {
        packsOpened?: number;
        referralEarned?: { l1?: number; l2?: number; l3?: number };
      };
      const e = s.referralEarned ?? {};
      const parent = (r as any).referred_by != null ? Number((r as any).referred_by) : null;
      players.set(id, {
        id,
        name: (r as any).username
          ? `@${(r as any).username}`
          : ((r as any).first_name as string) || String(id),
        banned: Boolean((r as any).banned),
        parent,
        packs: Number(s.packsOpened ?? 0) || 0,
        earned:
          Math.round(
            ((Number(e.l1 ?? 0) || 0) + (Number(e.l2 ?? 0) || 0) + (Number(e.l3 ?? 0) || 0)) * 10000,
          ) / 10000,
        joinedAt: (r as any).created_at as string,
      });
      if (parent && parent !== id) {
        const list = children.get(parent) ?? [];
        list.push(id);
        children.set(parent, list);
      }
    }

    const depositByPlayer = new Map<number, number>();
    for (const d of deposits ?? []) {
      const id = Number((d as any).telegram_id);
      depositByPlayer.set(id, (depositByPlayer.get(id) ?? 0) + (Number((d as any).amount) || 0));
    }

    const out: AdminReferrer[] = [];
    for (const p of players.values()) {
      const seen = new Set<number>([p.id]);
      const levels: number[][] = [];
      let frontier = (children.get(p.id) ?? []).filter((id) => !seen.has(id));
      for (let depth = 0; depth < 3; depth += 1) {
        frontier.forEach((id) => seen.add(id));
        levels.push(frontier);
        frontier = frontier
          .flatMap((id) => children.get(id) ?? [])
          .filter((id) => !seen.has(id));
      }

      const all = levels.flat();
      if (!all.length) continue;

      let qualified = 0;
      let packs = 0;
      let deposited = 0;
      for (const id of all) {
        const c = players.get(id);
        if (!c) continue;
        if (c.packs > 0) qualified += 1;
        packs += c.packs;
        deposited += depositByPlayer.get(id) ?? 0;
      }

      out.push({
        telegramId: p.id,
        name: p.name,
        banned: p.banned,
        l1: levels[0]?.length ?? 0,
        l2: levels[1]?.length ?? 0,
        l3: levels[2]?.length ?? 0,
        total: all.length,
        qualified,
        earned: p.earned,
        depositedByNetwork: Math.round(deposited * 10000) / 10000,
        packsByNetwork: packs,
        joinedAt: p.joinedAt,
      });
    }

    return out
      .sort((a, b) => b.qualified - a.qualified || b.total - a.total || b.earned - a.earned)
      .slice(0, 100);
  });

export const adminBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: Input & { text: string }) => {
    requireInitData(input);
    if (!input.text?.trim()) throw new Error("Message is empty");
    if (input.text.length > 3500) throw new Error("Message is too long");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await adminCtx(data.initData);
    const { notifyUser } = await import("./telegram.server");

    const { data: rows } = await supabaseAdmin
      .from("players")
      .select("telegram_id")
      .eq("banned", false)
      .limit(5000);

    let sent = 0;
    for (const row of rows ?? []) {
      await notifyUser(Number(row.telegram_id), data.text);
      sent += 1;
      // Telegram allows ~30 messages/second for broadcasts.
      if (sent % 25 === 0) await new Promise((r) => setTimeout(r, 1000));
    }
    return { sent };
  });

export type AdminIpAccount = {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  banned: boolean;
  lastSeen: string;
  createdAt: string;
  deposits: number;
  depositTotal: number;
  withdrawn: number;
  packs: number;
  cards: number;
  gram: number;
  wallet: string | null;
  signals: string[];
  risk: number;
};

export type AdminIpGroup = {
  ip: string;
  accounts: AdminIpAccount[];
  bannedCount: number;
  activeCount: number;
  /** Accounts in this network showing two or more farming signals. */
  flagged: number;
  risk: number;
};

/** A real pack always leaves at least this much XP behind. */
const MIN_XP_PER_PACK = 30;
/** Accounts registered this close together count as one registration burst. */
const BURST_WINDOW_MS = 60 * 60 * 1000;

function handle(p: any): string {
  return String(p?.username ?? p?.first_name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function similarHandle(a: string, b: string): boolean {
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  const digits = (s: string) => s.replace(/[0-9]/g, "");
  if (digits(a) && digits(a) === digits(b)) return true;
  return a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5));
}

/**
 * Networks with more than one account, each account annotated with the farming
 * signals it shows, so the whole picture can be reviewed before banning.
 */
export const adminMultiAccounts = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }): Promise<AdminIpGroup[]> => {
    const { supabaseAdmin } = await adminCtx(data.initData);

    const { data: rows } = await supabaseAdmin
      .from("player_ips")
      .select("ip, telegram_id, last_seen")
      .order("last_seen", { ascending: false })
      .limit(5000);

    const byIp = new Map<string, Array<{ telegramId: number; lastSeen: string }>>();
    for (const row of rows ?? []) {
      const ip = row.ip as string;
      const list = byIp.get(ip) ?? [];
      if (!list.some((x) => x.telegramId === Number(row.telegram_id))) {
        list.push({ telegramId: Number(row.telegram_id), lastSeen: row.last_seen as string });
      }
      byIp.set(ip, list);
    }

    const shared = [...byIp.entries()].filter(([, list]) => list.length > 1);
    const ids = [...new Set(shared.flatMap(([, list]) => list.map((x) => x.telegramId)))];
    if (!ids.length) return [];

    const [{ data: players }, { data: deposits }, { data: withdrawals }] = await Promise.all([
      supabaseAdmin
        .from("players")
        .select("telegram_id, username, first_name, banned, created_at, referred_by, state, ton_address")
        .in("telegram_id", ids),
      supabaseAdmin.from("ton_deposits").select("telegram_id, amount").in("telegram_id", ids),
      supabaseAdmin
        .from("withdrawals")
        .select("telegram_id, net, to_address, status")
        .in("telegram_id", ids),
    ]);

    const info = new Map<number, any>();
    for (const p of players ?? []) info.set(Number(p.telegram_id), p);

    const dep = new Map<number, { count: number; total: number }>();
    for (const d of deposits ?? []) {
      const id = Number(d.telegram_id);
      const cur = dep.get(id) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(d.amount ?? 0);
      dep.set(id, cur);
    }

    const out = new Map<number, number>();
    const payout = new Map<number, string>();
    for (const w of withdrawals ?? []) {
      const id = Number(w.telegram_id);
      if (w.status === "sent") out.set(id, (out.get(id) ?? 0) + Number(w.net ?? 0));
      const addr = String(w.to_address ?? "").trim();
      if (addr) payout.set(id, addr);
    }

    const groups: AdminIpGroup[] = shared.map(([ip, list]) => {
      const base = list.map((x) => {
        const p = info.get(x.telegramId) ?? {};
        const state = (p.state ?? {}) as Record<string, any>;
        const counter = Math.max(0, Math.floor(Number(state["packsOpened"] ?? 0) || 0));
        const xp = Math.max(0, Number(state["xp"] ?? 0) || 0);
        const packs = Math.min(counter, Math.floor(xp / MIN_XP_PER_PACK));
        const money = dep.get(x.telegramId) ?? { count: 0, total: 0 };
        return {
          telegramId: x.telegramId,
          username: (p.username as string | null) ?? null,
          firstName: (p.first_name as string | null) ?? null,
          banned: Boolean(p.banned),
          lastSeen: x.lastSeen,
          createdAt: (p.created_at as string) ?? "",
          deposits: money.count,
          depositTotal: Math.round(money.total * 10000) / 10000,
          withdrawn: Math.round((out.get(x.telegramId) ?? 0) * 10000) / 10000,
          packs,
          cards: Object.keys((state["owned"] ?? {}) as Record<string, unknown>).length,
          gram: Math.round((Number(state["gram"] ?? 0) || 0) * 10000) / 10000,
          wallet:
            (String(p.ton_address ?? "").trim() || payout.get(x.telegramId) || null) ?? null,
          referredBy: p.referred_by == null ? null : Number(p.referred_by),
          tampered: counter > packs,
          handle: handle(p),
          created: Date.parse((p.created_at as string) ?? "") || 0,
        };
      });

      const accounts: AdminIpAccount[] = base.map((a) => {
        const others = base.filter((o) => o.telegramId !== a.telegramId);
        const signals: string[] = [];
        let risk = 0;
        if (a.tampered) {
          signals.push("Tampered profile");
          risk += 4;
        }
        if (a.wallet && others.some((o) => o.wallet && o.wallet === a.wallet)) {
          signals.push("Shared payout wallet");
          risk += 3;
        }
        if (base.length > 3) {
          signals.push(`${base.length} accounts on this network`);
          risk += 2;
        }
        if (
          others.some(
            (o) => o.created && a.created && Math.abs(o.created - a.created) <= BURST_WINDOW_MS,
          )
        ) {
          signals.push("Registered in the same burst");
          risk += 2;
        }
        if (
          (a.referredBy != null && others.some((o) => o.telegramId === a.referredBy)) ||
          others.some((o) => o.referredBy === a.telegramId)
        ) {
          signals.push("Invited each other");
          risk += 2;
        }
        if (others.some((o) => similarHandle(a.handle, o.handle))) {
          signals.push("Near-identical name");
          risk += 1;
        }
        if (!a.deposits && a.withdrawn > 0) {
          signals.push("Withdrew without ever depositing");
          risk += 2;
        }
        if (!a.deposits && a.packs === 0) {
          signals.push("Never spent anything");
          risk += 1;
        }
        return {
          telegramId: a.telegramId,
          username: a.username,
          firstName: a.firstName,
          banned: a.banned,
          lastSeen: a.lastSeen,
          createdAt: a.createdAt,
          deposits: a.deposits,
          depositTotal: a.depositTotal,
          withdrawn: a.withdrawn,
          packs: a.packs,
          cards: a.cards,
          gram: a.gram,
          wallet: a.wallet,
          signals,
          risk,
        };
      });

      const flagged = accounts.filter((a) => a.signals.length >= 2 && !a.deposits).length;
      return {
        ip,
        accounts: accounts.sort((m, n) => n.risk - m.risk),
        bannedCount: accounts.filter((a) => a.banned).length,
        activeCount: accounts.filter((a) => !a.banned).length,
        flagged,
        risk: accounts.reduce((s, a) => Math.max(s, a.risk), 0),
      };
    });

    return groups
      .sort(
        (a, b) =>
          b.flagged - a.flagged || b.risk - a.risk || b.accounts.length - a.accounts.length,
      )
      .slice(0, 100);
  });

/* ------------------------------------------------------------------ *
 * Market watch
 *
 * Flags pairs of accounts that keep trading with each other: repeated
 * sales/swaps between the same two players is the classic signature of a
 * farm moving cards and GRAM between its own accounts.
 * ------------------------------------------------------------------ */

export type MarketPair = {
  a: { telegramId: number; name: string; banned: boolean };
  b: { telegramId: number; name: string; banned: boolean };
  sales: number;
  swaps: number;
  gram: number;
  lastAt: string;
};

export const adminMarketWatch = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => requireInitData(input))
  .handler(async ({ data }): Promise<MarketPair[]> => {
    const { supabaseAdmin } = await adminCtx(data.initData);

    const [{ data: sold }, { data: swapped }] = await Promise.all([
      supabaseAdmin
        .from("market_listings")
        .select("seller_id, buyer_id, price, sold_at")
        .eq("status", "sold")
        .order("sold_at", { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from("market_trades")
        .select("owner_id, taker_id, done_at")
        .eq("status", "done")
        .order("done_at", { ascending: false })
        .limit(2000),
    ]);

    type Agg = { sales: number; swaps: number; gram: number; lastAt: string };
    const pairs = new Map<string, Agg>();
    const key = (x: number, y: number) => [x, y].sort((m, n) => m - n).join(":");
    const bump = (x: number, y: number, at: string, gram: number, swap: boolean) => {
      if (!x || !y || x === y) return;
      const k = key(x, y);
      const cur = pairs.get(k) ?? { sales: 0, swaps: 0, gram: 0, lastAt: at };
      if (swap) cur.swaps += 1;
      else cur.sales += 1;
      cur.gram += gram;
      if (at > cur.lastAt) cur.lastAt = at;
      pairs.set(k, cur);
    };

    for (const r of sold ?? [])
      bump(
        Number(r.seller_id),
        Number(r.buyer_id),
        (r.sold_at as string) ?? "",
        Number(r.price ?? 0),
        false,
      );
    for (const r of swapped ?? [])
      bump(Number(r.owner_id), Number(r.taker_id), (r.done_at as string) ?? "", 0, true);

    // Two or more closed deals between the same two accounts is the signal.
    const flagged = [...pairs.entries()].filter(([, v]) => v.sales + v.swaps >= 2);
    if (!flagged.length) return [];

    const ids = [...new Set(flagged.flatMap(([k]) => k.split(":").map(Number)))];
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("telegram_id, username, first_name, banned")
      .in("telegram_id", ids);
    const info = new Map<number, any>();
    for (const p of players ?? []) info.set(Number(p.telegram_id), p);
    const who = (id: number) => {
      const p = info.get(id);
      return {
        telegramId: id,
        name: p?.username ? `@${p.username}` : (p?.first_name as string) || String(id),
        banned: Boolean(p?.banned),
      };
    };

    return flagged
      .map(([k, v]) => {
        const [x, y] = k.split(":").map(Number);
        return {
          a: who(x!),
          b: who(y!),
          sales: v.sales,
          swaps: v.swaps,
          gram: Math.round(v.gram * 10000) / 10000,
          lastAt: v.lastAt,
        };
      })
      .sort((m, n) => n.sales + n.swaps - (m.sales + m.swaps))
      .slice(0, 50);
  });
