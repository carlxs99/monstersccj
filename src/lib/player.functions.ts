import { createServerFn } from "@tanstack/react-start";

/** Cloud sync for the Telegram Mini App player profile. */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type SyncInput = { initData: string; name?: string; startParam?: string };

/** Public bot handle + Mini App short name, used to build referral deep links. */
export const getBotUsername = createServerFn({ method: "GET" }).handler(async () => {
  const username = (process.env["TELEGRAM_BOT_USERNAME"] ?? "MonstersCardsBot").replace("@", "");
  const appName = (process.env["TELEGRAM_APP_NAME"] ?? "app").replace("/", "");
  return { username, appName, base: `https://t.me/${username}/${appName}` };
});

/** Fresh profiles start empty — GRAM only enters the game through deposits. */
const emptyState = () => ({
  gram: 0,
  xp: 0,
  packsOpened: 0,
  owned: {},
  lastClaimAt: Date.now(),
  totalEarned: 0,
  tasksClaimed: {},
  referralEarned: { l1: 0, l2: 0, l3: 0 },
});

function codeFor(telegramId: number) {
  return "GR" + String(telegramId % 1000000).padStart(6, "0");
}

export const syncPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: SyncInput) => {
    if (!input || typeof input.initData !== "string") throw new Error("Missing Telegram session");
    return input;
  })
  .handler(async ({ data }) => {
    const { verifyInitData } = await import("./telegram.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await verifyInitData(data.initData);

    const referralCode = codeFor(user.id);
    const startParam = (
      data.startParam ||
      new URLSearchParams(data.initData).get("start_param") ||
      ""
    )
      .trim()
      .toUpperCase();

    const { data: existing } = await supabaseAdmin
      .from("players")
      .select("state, referred_by, referral_code")
      .eq("telegram_id", user.id)
      .maybeSingle();

    // Resolve the inviter the first time this player shows up.
    let referredBy: number | null = (existing?.referred_by as number | null) ?? null;
    if (!referredBy && /^GR\d{6}$/.test(startParam) && startParam !== referralCode) {
      const { data: inviter } = await supabaseAdmin
        .from("players")
        .select("telegram_id")
        .eq("referral_code", startParam)
        .maybeSingle();
      if (inviter) referredBy = inviter.telegram_id as number;
    }

    // The client is never trusted with balances or progress: it may only read
    // the stored state. All mutations happen in game.functions / wallet.functions.
    const existingState = (existing?.state as Record<string, Json> | null) ?? null;
    const nextState: Json = existingState ?? (emptyState() as Json);

    const { error } = await supabaseAdmin.from("players").upsert(
      {
        telegram_id: user.id,
        username: user.username ?? null,
        first_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
        photo_url: user.photo_url ?? null,
        referral_code: referralCode,
        referred_by: referredBy,
        ...(existingState ? {} : { state: nextState }),
      },
      { onConflict: "telegram_id" },
    );
    if (error) throw new Error(error.message);

    // Backfill the Telegram profile photo once so it can be shown in the app.
    if (!user.photo_url && !(existing as { photo_file_id?: string | null } | null)?.photo_file_id) {
      const { profilePhotoFileId } = await import("./telegram.server");
      const fileId = await profilePhotoFileId(user.id);
      if (fileId) {
        await supabaseAdmin
          .from("players")
          .update({ photo_file_id: fileId })
          .eq("telegram_id", user.id);
      }
    }

    // Multi-account guard: several accounts sharing one network address are
    // suspended automatically (including every new one that joins later).
    const { getRequest } = await import("@tanstack/react-start/server");
    const { clientIp, trackIp } = await import("./multiaccount.server");
    const ban = await trackIp(supabaseAdmin, user.id, clientIp(getRequest().headers));

    // Referral network: direct invites, then two more levels down. Qualified
    // members are the ones that already bought their first pack.
    const { referralNetwork } = await import("./referrals.server");
    const network = await referralNetwork(supabaseAdmin, user.id);


    return {
      telegramId: user.id,
      name:
        [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Collector",
      username: user.username ?? null,
      photoUrl: user.photo_url ?? null,
      referralCode,
      referredBy,
      referrals: network.referrals,
      referralsQualified: network.referralsQualified,
      state: nextState,
      banned: ban.banned,
      banReason: ban.reason,
    };
  });

/** Always-fresh referral summary for the Invite screen. */
export const fetchReferrals = createServerFn({ method: "POST" })
  .inputValidator((input: { initData: string }) => {
    if (!input || typeof input.initData !== "string") throw new Error("Missing Telegram session");
    return input;
  })
  .handler(async ({ data }) => {
    const { verifyInitData } = await import("./telegram.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await verifyInitData(data.initData);

    const { data: me } = await supabaseAdmin
      .from("players")
      .select("referred_by, referral_code, state")
      .eq("telegram_id", user.id)
      .maybeSingle();

    const { referralNetwork } = await import("./referrals.server");
    const network = await referralNetwork(supabaseAdmin, user.id);

    const st = (me?.state ?? {}) as Record<string, Json>;
    const earnedRaw = (st["referralEarned"] ?? {}) as Record<string, number>;
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

    return {
      referralCode: (me?.referral_code as string | null) ?? codeFor(user.id),
      referredBy: (me?.referred_by as number | null) ?? null,
      referrals: network.referrals,
      referralsQualified: network.referralsQualified,
      referralEarned: {
        l1: num(earnedRaw["l1"]),
        l2: num(earnedRaw["l2"]),
        l3: num(earnedRaw["l3"]),
      },
    };
  });

export const fetchLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ADMIN_TELEGRAM_ID = 6334940213;
  // Fetch ALL non-banned players in pages — a fixed limit would silently drop
  // players from the ranking once the community outgrows it.
  type PlayerRow = {
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    photo_file_id: string | null;
    state: unknown;
  };
  const all: PlayerRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabaseAdmin
      .from("players")
      .select("telegram_id, username, first_name, photo_url, photo_file_id, state")
      .eq("banned", false)
      .order("telegram_id", { ascending: true })
      .range(from, from + PAGE - 1);
    all.push(...((data ?? []) as PlayerRow[]));
    if (!data || data.length < PAGE) break;
  }
  const rows = all.filter((r) => r.telegram_id !== ADMIN_TELEGRAM_ID);

  // Backfill Telegram profile photos for players that don't have one yet
  // (capped per request so the endpoint stays fast; the rest fill in over time).
  const missing = rows.filter((r) => !r.photo_url && !r.photo_file_id).slice(0, 20);
  if (missing.length) {
    const { profilePhotoFileId } = await import("./telegram.server");
    await Promise.all(
      missing.map(async (r) => {
        const fileId = await profilePhotoFileId(r.telegram_id as number);
        if (!fileId) return;
        r.photo_file_id = fileId;
        await supabaseAdmin
          .from("players")
          .update({ photo_file_id: fileId })
          .eq("telegram_id", r.telegram_id as number);
      }),
    );
  }

  const avatarOf = (row: { photo_url: unknown; photo_file_id: unknown }) => {
    const direct = row.photo_url as string | null;
    if (direct && /^https:\/\//.test(direct)) return direct;
    const fileId = row.photo_file_id as string | null;
    return fileId ? `/api/public/avatar?f=${encodeURIComponent(fileId)}` : null;
  };

  return rows.map((row) => ({
    id: row.telegram_id as number,
    name: (row.first_name as string | null) ?? (row.username as string | null) ?? "Collector",
    photoUrl: avatarOf(row),
    // Only the fields needed to rank players — balances stay private.
    state: (() => {
      const st = (row.state ?? {}) as Record<string, Json>;
      return {
        owned: st["owned"] ?? {},
        xp: st["xp"] ?? 0,
        packsOpened: st["packsOpened"] ?? 0,
      } as Json;
    })(),
  }));
});
