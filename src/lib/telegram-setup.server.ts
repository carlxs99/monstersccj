/** One-shot bot configuration: webhook, menu button and commands. */
export async function setupTelegramBot() {
  const { botApi } = await import("./telegram.server");
  const appUrl = "https://monstercards.lovable.app";
  const webhookUrl = "https://project--e2fc5d41-efed-457b-8a8a-3840e26bbe3e-dev.lovable.app";
  const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];

  const me = (await botApi("getMe", {})) as { ok: boolean; result?: { username?: string } };

  const webhook = await botApi("setWebhook", {
    url: `${webhookUrl}/api/public/telegram/webhook`,
    allowed_updates: ["message"],
    ...(secret ? { secret_token: secret } : {}),
  });

  await botApi("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Play", web_app: { url: appUrl } },
  });

  await botApi("setMyCommands", {
    commands: [
      { command: "start", description: "Open Monsters Cards" },
      { command: "stats", description: "Your collection summary" },
      { command: "invite", description: "Your referral code" },
      { command: "help", description: "Bot commands" },
    ],
  });

  return { bot: me.result?.username ?? null, webhook: webhook.ok };
}
