import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Daily reminder broadcast. Called hourly by pg_cron; it only starts one run
 * per UTC day and sends a bounded batch per invocation so a large player base
 * is drained across several runs without hitting Telegram rate limits.
 */

const BATCH = 150;
const CHUNK = 20;
const CHUNK_PAUSE_MS = 1100;
const LOCK_MS = 3 * 60 * 1000;

const APP_URL = "https://t.me/MonstersCardsBot/app";

const TEXT =
  "\u23f0 <b>Your GRAM is piling up!</b>\n\n" +
  "Your monsters have been mining while you were away.\n" +
  "\ud83d\udcb0 Open the app and claim your daily earnings before the vault fills up.\n" +
  "\ud83c\udfb4 Open a booster pack and boost your daily production.\n\n" +
  "Tap below and collect now \ud83d\udc47";

export const Route = createFileRoute("/api/public/broadcast/daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("Not configured", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const day = new Date().toISOString().slice(0, 10);
        const nowIso = new Date().toISOString();
        const lockIso = new Date(Date.now() + LOCK_MS).toISOString();

        // Create today's run (idempotent) then take the single-flight lease.
        await supabaseAdmin.from("broadcast_runs").insert({ day }).select().maybeSingle();

        const { data: run } = await supabaseAdmin
          .from("broadcast_runs")
          .select("day, done, sent_count")
          .eq("day", day)
          .maybeSingle();
        if (!run || run.done) return Response.json({ ok: true, skipped: "done" });

        const { data: leased } = await supabaseAdmin
          .from("broadcast_runs")
          .update({ lock_until: lockIso })
          .eq("day", day)
          .or(`lock_until.is.null,lock_until.lt.${nowIso}`)
          .select("day")
          .maybeSingle();
        if (!leased) return Response.json({ ok: true, skipped: "locked" });

        // PostgREST caps responses at 1,000 rows: page through everything.
        const PAGE = 1000;
        const sentRows: { telegram_id: number }[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data } = await supabaseAdmin
            .from("broadcast_sends")
            .select("telegram_id")
            .eq("day", day)
            .order("telegram_id", { ascending: true })
            .range(from, from + PAGE - 1);
          sentRows.push(...((data ?? []) as { telegram_id: number }[]));
          if (!data || data.length < PAGE) break;
        }
        const already = new Set(sentRows.map((r) => Number(r.telegram_id)));

        const players: { telegram_id: number }[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data } = await supabaseAdmin
            .from("players")
            .select("telegram_id")
            .order("telegram_id", { ascending: true })
            .range(from, from + PAGE - 1);
          players.push(...((data ?? []) as { telegram_id: number }[]));
          if (!data || data.length < PAGE) break;
        }

        const targets = (players ?? [])
          .map((p) => Number(p.telegram_id))
          .filter((id) => id > 0 && !already.has(id))
          .slice(0, BATCH);

        if (targets.length === 0) {
          await supabaseAdmin
            .from("broadcast_runs")
            .update({ done: true, lock_until: null })
            .eq("day", day);
          return Response.json({ ok: true, sent: 0, finished: true });
        }

        const reply_markup = {
          inline_keyboard: [[{ text: "\ud83d\udcb0 Claim my GRAM", url: APP_URL }]],
        };

        let sent = 0;
        for (let i = 0; i < targets.length; i += CHUNK) {
          const chunk = targets.slice(i, i + CHUNK);
          await Promise.all(
            chunk.map(async (chatId) => {
              try {
                const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: TEXT,
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    reply_markup,
                  }),
                });
                const body = (await res.json()) as { ok: boolean; description?: string };
                // Blocked / deleted chats are permanent: mark them so we skip
                // them for the rest of the day instead of retrying forever.
                const permanent =
                  body.ok || /blocked|deactivated|chat not found|can't initiate/i.test(
                    body.description ?? "",
                  );
                if (permanent) {
                  await supabaseAdmin
                    .from("broadcast_sends")
                    .upsert({ day, telegram_id: chatId }, { onConflict: "day,telegram_id" });
                  if (body.ok) sent += 1;
                }
              } catch (error) {
                console.error("broadcast send failed", chatId, error);
              }
            }),
          );
          if (i + CHUNK < targets.length)
            await new Promise((r) => setTimeout(r, CHUNK_PAUSE_MS));
        }

        await supabaseAdmin
          .from("broadcast_runs")
          .update({ sent_count: (run.sent_count ?? 0) + sent, lock_until: null })
          .eq("day", day);

        return Response.json({ ok: true, sent, batch: targets.length });
      },
    },
  },
});
