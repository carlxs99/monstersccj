/** Server-only TON blockchain helpers: deposit scanning and payouts. */

export const DEPOSIT_ADDRESS = "UQBtZr7CehYj3mVActM3gr1MhU3K7NkdMdAKEjIQ6rrJR4RP";
export const WITHDRAW_FEE_RATE = 0.05;
export const MIN_WITHDRAW = 0.5;
/** Safety ceiling for a single automated payout. */
export const MAX_WITHDRAW = 500;
export const MIN_DEPOSIT = 0.01;

const API = "https://toncenter.com/api/v3";
const API_V2 = "https://toncenter.com/api/v2";

class TonApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(`TON network error (${status})`);
  }
}

/**
 * The payout may or may not have reached the chain. Callers must NEVER refund
 * on this error: the withdrawal has to be reviewed by hand instead.
 */
export class TonSendUncertainError extends Error {}

function apiHeaders(): Record<string, string> {
  const key = process.env["TONCENTER_API_KEY"];
  return key ? { "X-API-Key": key } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...apiHeaders(), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`TON API ${path} failed [${res.status}]: ${text}`);
    throw new TonApiError(res.status, text);
  }
  return JSON.parse(text) as T;
}

async function currentSeqno(address: string): Promise<number> {
  const res = await fetch(`${API_V2}/runGetMethod`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...apiHeaders() },
    body: JSON.stringify({ address, method: "seqno", stack: [] }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`TON seqno lookup failed [${res.status}]: ${text}`);
    throw new TonApiError(res.status, text);
  }
  const data = JSON.parse(text) as {
    ok?: boolean;
    result?: { exit_code?: number; stack?: Array<[string, string]> };
  };
  const raw = data.result?.stack?.[0]?.[1];
  const seqno = raw ? Number.parseInt(raw, 16) : Number.NaN;
  if (!data.ok || data.result?.exit_code !== 0 || !Number.isSafeInteger(seqno)) {
    throw new Error("Could not read the payout wallet sequence");
  }
  return seqno;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ChainDeposit = {
  hash: string;
  lt: number;
  amount: number;
  memo: string;
  from: string;
  at: number;
};

type TxResponse = {
  transactions?: Array<{
    hash: string;
    lt: string;
    now: number;
    in_msg?: {
      source?: string | null;
      value?: string | null;
      message_content?: { decoded?: { comment?: string } | null } | null;
    } | null;
  }>;
};

/** Reads incoming transfers to the game wallet newer than `sinceLt`. */
export async function fetchIncoming(sinceLt: number): Promise<ChainDeposit[]> {
  const params = new URLSearchParams({
    account: DEPOSIT_ADDRESS,
    limit: "100",
    sort: "desc",
  });
  if (sinceLt > 0) params.set("start_lt", String(sinceLt + 1));

  const data = await api<TxResponse>(`/transactions?${params.toString()}`);
  const out: ChainDeposit[] = [];

  for (const tx of data.transactions ?? []) {
    const msg = tx.in_msg;
    if (!msg || !msg.source) continue; // external message, not a transfer
    const amount = Number(msg.value ?? 0) / 1e9;
    if (!(amount > 0)) continue;
    out.push({
      hash: tx.hash,
      lt: Number(tx.lt),
      amount,
      memo: (msg.message_content?.decoded?.comment ?? "").trim(),
      from: msg.source,
      at: tx.now,
    });
  }
  return out;
}

/** Signs and broadcasts a TON payout from the game hot wallet. */
export async function sendTon(to: string, amount: number, comment: string): Promise<string> {
  const mnemonic = process.env["TON_WALLET_MNEMONIC"];
  if (!mnemonic) throw new Error("Payout wallet is not configured yet");

  const [{ mnemonicToPrivateKey }, core, ton] = await Promise.all([
    import("@ton/crypto"),
    import("@ton/core"),
    import("@ton/ton"),
  ]);

  const words = mnemonic.trim().split(/\s+/);
  const keys = await mnemonicToPrivateKey(words);
  const wallet = ton.WalletContractV5R1.create({ publicKey: keys.publicKey });
  const address = wallet.address.toString({ bounceable: false, urlSafe: true });

  // toncenter v3 returns the wallet object directly; older shapes nest it in `wallets`.
  const info = await api<{
    seqno?: number | string | null;
    status?: string;
    balance?: string | number | null;
    wallets?: Array<{ seqno?: number | string | null; status?: string; balance?: string | null }>;
  }>(`/walletInformation?address=${encodeURIComponent(address)}`);
  const row = info.wallets?.[0] ?? info;
  const reportedSeqno = Number(row.seqno ?? 0);
  const seqno = await currentSeqno(address);
  const deployed = (row.status ?? "") === "active" || seqno > 0;
  if (!Number.isFinite(reportedSeqno)) throw new Error("Could not read the payout wallet state");

  const balance = Number(row.balance ?? 0) / 1e9;
  if (balance < amount + 0.05) throw new Error("Payout wallet balance is too low right now");

  let result: { message_hash?: string } | undefined;
  let nextSeqno = seqno;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const transfer = wallet.createTransfer({
      seqno: nextSeqno,
      secretKey: keys.secretKey,
      sendMode: core.SendMode.PAY_GAS_SEPARATELY + core.SendMode.IGNORE_ERRORS,
      timeout: Math.floor(Date.now() / 1000) + 180,
      messages: [
        core.internal({
          to: core.Address.parse(to),
          value: BigInt(Math.round(amount * 1e9)),
          bounce: false,
          body: comment,
        }),
      ],
    });
    const external = core.external({
      to: wallet.address,
      ...(deployed ? {} : { init: wallet.init }),
      body: transfer,
    });
    const boc = core.beginCell().store(core.storeMessage(external)).endCell().toBoc();
    const base64 = Buffer.from(boc).toString("base64");

    try {
      result = await api<{ message_hash?: string }>("/message", {
        method: "POST",
        body: JSON.stringify({ boc: base64 }),
      });
      break;
    } catch (error) {
      const staleSeqno = error instanceof TonApiError && /exitcode=33|exit code 33/i.test(error.responseBody);
      if (staleSeqno && attempt < 3) {
        await wait(1200);
        nextSeqno = await currentSeqno(address);
        continue;
      }
      // A 4xx rejection means the node refused the message before broadcasting,
      // so the coins never left. Anything else (timeout, network drop, 5xx,
      // exhausted retries) may already be on chain: never refund blindly.
      const rejected =
        error instanceof TonApiError && error.status >= 400 && error.status < 500 && error.status !== 429;
      if (rejected) throw error;
      throw new TonSendUncertainError(error instanceof Error ? error.message : "Payout broadcast unclear");
    }
  }
  if (!result) throw new Error("Payout could not be broadcast");
  const hash = result.message_hash ?? "";
  // toncenter returns a base64 hash; explorers expect hex.
  return /^[0-9a-fA-F]{64}$/.test(hash)
    ? hash.toLowerCase()
    : hash
      ? Buffer.from(hash, "base64").toString("hex")
      : "";
}

/** Basic sanity check for a user-supplied TON address. */
export async function isValidAddress(value: string) {
  try {
    const core = await import("@ton/core");
    core.Address.parse(value.trim());
    return true;
  } catch {
    return false;
  }
}
