/** Server-only helpers for Telegram Mini App auth and Bot API calls. */

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison so the signature cannot be probed byte by byte. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  return timingSafeEqualHex(a, b);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Validates Telegram WebApp initData and returns the authenticated user.
 * Throws when the signature is missing, invalid or older than 24h.
 */
export async function verifyInitData(initData: string): Promise<TelegramUser> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Telegram bot token is not configured");
  if (!initData) throw new Error("Missing Telegram session");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Invalid Telegram session");
  params.delete("hash");

  const checkString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = await hmac(enc.encode("WebAppData"), token);
  const signature = hex(await hmac(secret, checkString));
  if (!timingSafeEqualHex(signature, hash)) throw new Error("Invalid Telegram signature");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400)
    throw new Error("Telegram session expired");

  const raw = params.get("user");
  if (!raw) throw new Error("Missing Telegram user");
  return JSON.parse(raw) as TelegramUser;
}

/** Calls the Telegram Bot API with the configured bot token. */
export async function botApi(method: string, payload: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Telegram bot token is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!res.ok || !body.ok) {
    console.error(`Telegram ${method} failed [${res.status}]:`, body.description);
  }
  return body;
}

/** Returns the smallest profile-photo file_id for a user, or null. Best-effort. */
export async function profilePhotoFileId(telegramId: number): Promise<string | null> {
  try {
    const res = await botApi("getUserProfilePhotos", { user_id: telegramId, limit: 1 });
    const photos = (res.result as { photos?: { file_id: string }[][] } | undefined)?.photos;
    const sizes = photos?.[0];
    return sizes?.length ? sizes[0]!.file_id : null;
  } catch {
    return null;
  }
}

/** Sends a bot notification to a player. Retries transient failures. Never throws. */
export async function notifyUser(telegramId: number, text: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = (await botApi("sendMessage", {
        chat_id: telegramId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      })) as { ok: boolean; description?: string; parameters?: { retry_after?: number } };
      if (body.ok) return;
      const desc = body.description ?? "";
      // Permanent failures: user blocked the bot or never started it.
      if (/blocked|deactivated|chat not found|can't initiate/i.test(desc)) return;
      const wait = Math.min((body.parameters?.retry_after ?? 1) * 1000, 5000);
      await new Promise((r) => setTimeout(r, wait));
    } catch (error) {
      console.error("Telegram notification failed", error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.error("Telegram notification gave up", { telegramId });
}


/** Public channel where every successful payout is announced. */
export const PAYOUTS_CHANNEL = "@mosnstercardspayouts";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Announces a completed withdrawal in the public payouts channel. Never throws. */
export async function announcePayout(input: { name: string; amount: number; hash?: string }) {
  try {
    const name = escapeHtml(input.name || "Anonymous");
    const lines = [
      "\u2705 <b>Withdraw Approved!</b>",
      "",
      `\ud83d\udc64 User: <b>${name}</b>`,
      "",
      `\ud83d\udcb0 Amount: <b>${input.amount.toFixed(4)} GRAM</b>`,
    ];
    const payload: Record<string, unknown> = {
      chat_id: PAYOUTS_CHANNEL,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (input.hash) {
      payload["reply_markup"] = {
        inline_keyboard: [
          [{ text: "View on tonscan", url: `https://tonscan.org/tx/${input.hash}` }],
        ],
      };
    }
    await botApi("sendMessage", payload);
  } catch (error) {
    console.error("Payout announcement failed", error);
  }
}
