/** Server-only helpers for player state persistence and referral commissions. */
import { initialState, REFERRAL_RATES, round4, round6, type PlayerState } from "./progress";

type Admin = any;

export function mergeState(raw: unknown): PlayerState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  return { ...base, ...(raw as Partial<PlayerState>) };
}

export async function loadState(admin: Admin, telegramId: number) {
  return (await loadStateRaw(admin, telegramId)).state;
}

/** Same as loadState, but also returns the untouched stored JSON. */
export async function loadStateRaw(admin: Admin, telegramId: number) {
  const { data } = await admin
    .from("players")
    .select("state")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const raw = (data?.state ?? {}) as Record<string, unknown>;
  return { state: mergeState(data?.state), raw };
}

/**
 * Builds the optimistic guard for persistState from the fields that really
 * exist in the stored JSON (missing keys cannot be compared safely).
 */
export function guardFor(
  raw: Record<string, unknown>,
  state: PlayerState,
  keys: Array<keyof PlayerState>,
) {
  const guard: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) guard[key as string] = state[key];
  }
  return Object.keys(guard).length ? guard : null;
}

/**
 * Atomic write: the balance delta is applied under a row lock in Postgres, so
 * concurrent requests can never spend the same GRAM twice.
 */
export async function persistState(
  admin: Admin,
  telegramId: number,
  /**
   * Only the listed fields are merged into the stored JSON. Pass the smallest
   * possible patch: writing a whole snapshot read seconds earlier can roll back
   * a concurrent pack opening or task claim.
   */
  next: Partial<PlayerState>,
  gramDelta: number,
  /**
   * Optional optimistic guard: the listed fields must still hold these exact
   * values at lock time, so two concurrent requests can never pay the same
   * reward twice (double claim of yield or of a task).
   */
  expect?: Record<string, unknown> | null,
): Promise<PlayerState> {
  const { gram: _ignored, ...rest } = next;
  const { data, error } = await admin.rpc("apply_player_progress", {
    p_telegram_id: telegramId,
    p_state: rest,
    // 6 decimals: the amount credited must match exactly the amount the
    // player is shown (yield claims are computed at 6 decimals).
    p_gram_delta: round6(gramDelta),
    p_expect: expect ?? null,
  });
  if (error) {
    if (/insufficient balance/i.test(error.message))
      throw new Error("Not enough GRAM in your balance");
    if (/stale state/i.test(error.message)) throw new Error("Please try again");
    throw new Error(error.message);
  }
  return mergeState(data);
}

/**
 * Balance-only movement (battle pot, refund, commission, admin adjustment).
 * Touches nothing but `gram`, so it can never roll back progress written by a
 * request that ran in parallel.
 */
export async function creditGram(admin: Admin, telegramId: number, gramDelta: number) {
  return persistState(admin, telegramId, {}, gramDelta);
}


/** Blocks suspended accounts from any balance-changing action. */
export async function assertNotBanned(admin: Admin, telegramId: number) {
  const { data } = await admin
    .from("players")
    .select("banned")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (data?.banned) throw new Error("Your account has been suspended");
}

/** Pays 10% / 5% / 1% up the referral chain for a deposit or purchase. */
export async function payReferrals(admin: Admin, telegramId: number, spend: number) {
  if (!(spend > 0)) return;
  const levels: Array<keyof typeof REFERRAL_RATES> = ["l1", "l2", "l3"];
  let currentId: number | null = telegramId;
  // Never pay the same account twice, and never walk a referral cycle.
  const seen = new Set<number>([telegramId]);

  for (const level of levels) {
    const { data: row } = (await admin
      .from("players")
      .select("referred_by")
      .eq("telegram_id", currentId)
      .maybeSingle()) as { data: { referred_by: number | null } | null };
    const inviter: number | null = (row?.referred_by as number | null) ?? null;
    if (!inviter || seen.has(inviter)) return;
    seen.add(inviter);

    // Suspended inviters never collect commission: stop walking the chain.
    const { data: inviterRow } = (await admin
      .from("players")
      .select("banned")
      .eq("telegram_id", inviter)
      .maybeSingle()) as { data: { banned: boolean | null } | null };
    if (inviterRow?.banned) return;

    const amount = round4(spend * REFERRAL_RATES[level]);
    if (amount > 0) {
      let paid = false;
      try {
        const inviterState = await loadState(admin, inviter);
        const nextEarned = {
          ...inviterState.referralEarned,
          [level]: round4(inviterState.referralEarned[level] + amount),
        };
        // Patch only the commission ledger, never a whole stale snapshot.
        await persistState(admin, inviter, { referralEarned: nextEarned }, amount);
        paid = true;
      } catch (error) {
        console.error("Referral payout failed", error);
      }
      if (paid) {
        // Notification is always attempted after a successful credit; notifyUser never throws.
        const { notifyUser } = await import("./telegram.server");
        await notifyUser(
          inviter,
          `🎁 <b>Referral commission</b>\n+${amount.toFixed(4)} GRAM from a level ${level.slice(1)} friend (${Math.round(
            REFERRAL_RATES[level] * 100,
          )}%).`,
        );
      }
    }

    currentId = inviter;
  }
}

/**
 * Referral network split into total members and "qualified" ones (accounts
 * that already bought their first pack). Invite tasks only count qualified
 * referrals so nobody can farm rewards with empty throwaway accounts.
 */
export async function referralNetwork(admin: Admin, rootId: number) {
  const seen = new Set<number>([rootId]);
  const level = async (parents: number[]) => {
    if (!parents.length) return [] as Array<{ id: number; packs: number }>;
    // Chunk parent ids (URL length) and paginate (1000-row API cap) so big
    // networks are counted in full.
    const rows: unknown[] = [];
    for (let c = 0; c < parents.length; c += 200) {
      const chunk = parents.slice(c, c + 200);
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin
          .from("players")
          .select("telegram_id, state")
          .in("referred_by", chunk)
          .order("telegram_id", { ascending: true })
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
    }
    const out: Array<{ id: number; packs: number }> = [];
    for (const r of rows) {
      const id = Number((r as { telegram_id: number }).telegram_id);
      if (seen.has(id)) continue;
      seen.add(id);
      const st = ((r as { state?: Record<string, unknown> }).state ?? {}) as {
        packsOpened?: number;
      };
      out.push({ id, packs: Number(st.packsOpened ?? 0) || 0 });
    }
    return out;
  };

  const l1 = await level([rootId]);
  const l2 = await level(l1.map((x) => x.id));
  const l3 = await level(l2.map((x) => x.id));
  const q = (list: Array<{ packs: number }>) => list.filter((x) => x.packs > 0).length;

  return {
    ids: { l1: l1.map((x) => x.id), l2: l2.map((x) => x.id), l3: l3.map((x) => x.id) },
    referrals: { l1: l1.length, l2: l2.length, l3: l3.length },
    referralsQualified: { l1: q(l1), l2: q(l2), l3: q(l3) },
  };
}
