/**
 * Rewarded interstitial ad (Libtl SDK).
 * The SDK exposes a global function named after the zone's data-sdk attribute.
 * It resolves once the user has watched the ad or closed it from the
 * "continue" button, which returns control to the app.
 */

const SDK_FN = "show_12247409";

type ShowFn = () => Promise<unknown>;

function getShow(): ShowFn | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as Record<string, unknown>)[SDK_FN];
  return typeof fn === "function" ? (fn as ShowFn) : null;
}

/** Waits for the SDK global to appear (the script loads asynchronously). */
async function waitForSdk(timeoutMs = 4000): Promise<ShowFn | null> {
  const start = Date.now();
  for (;;) {
    const fn = getShow();
    if (fn) return fn;
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => window.setTimeout(r, 150));
  }
}

/**
 * Shows the rewarded interstitial. Resolves when the ad flow is finished so
 * the caller can grant the reward. Never blocks the reward if ads are
 * unavailable (blocked, offline, slow SDK).
 */
const DIRECT_LINK = "https://uplcm.com/4/12247434";
const TURN_KEY = "mc_ad_turn";

/** Opens the direct-link ad outside the app and resolves when the user comes back. */
async function showDirectLink(): Promise<void> {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
  try {
    if (tg?.openLink) tg.openLink(DIRECT_LINK);
    else window.open(DIRECT_LINK, "_blank", "noopener");
  } catch {
    return;
  }
  // Wait until the user returns to the app (page visible again), max 60 s.
  await new Promise<void>((resolve) => {
    let left = false;
    const done = () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(t);
      resolve();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") left = true;
      else if (left) done();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setTimeout(done, 60_000);
    // If the app never got hidden (link opened in-place overlay), continue after 3 s.
    window.setTimeout(() => { if (!left) done(); }, 3000);
  });
}

export async function showRewardedAd(): Promise<void> {
  if (typeof window === "undefined") return;
  let turn = 0;
  try {
    turn = Number(localStorage.getItem(TURN_KEY) || "0");
    localStorage.setItem(TURN_KEY, String(turn + 1));
  } catch { /* ignore */ }
  if (turn % 2 === 1) {
    await showDirectLink();
    return;
  }
  const show = await waitForSdk();
  if (!show) return;
  try {
    // Hard cap: if the SDK never resolves (hangs, ad closed via Telegram
    // back button, etc.), return control to the app anyway so the claim
    // flow always continues and the user is never stuck on the ad.
    const MAX_AD_MS = 60_000;
    await Promise.race([
      show(),
      new Promise<void>((resolve) => window.setTimeout(resolve, MAX_AD_MS)),
    ]);
  } catch {
    // Ignore ad errors: the user should still be able to claim.
  }
}
