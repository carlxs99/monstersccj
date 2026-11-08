import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { postForWeek, weekKey } from "@/lib/channel-posts";

/**
 * Weekly channel post. Called hourly by pg_cron; it publishes exactly one post
 * per ISO week to the public news channel and then skips every other call of
 * that week (the week row in channel_post_runs is the idempotency key).
 */

const CHANNEL = "@monstercardsnews";
const APP_URL = "https://t.me/MonstersCardsBot/app";

export const Route = createFileRoute("/api/public/broadcast/weekly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("Not configured", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { key, index } = weekKey();

        // Claim this week. The primary key makes concurrent runs collide, so
        // only the first invocation of the week ever posts.
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("channel_post_runs")
          .insert({ week_key: key, post_index: index % 100 })
          .select("week_key")
          .maybeSingle();

        if (claimError || !claimed) {
          return Response.json({ ok: true, skipped: "already sent", week: key });
        }

        const post = postForWeek(index);

        const endpoint = post.kind === "poll" ? "sendPoll" : "sendMessage";
        const body =
          post.kind === "poll"
            ? {
                chat_id: CHANNEL,
                question: post.question,
                options: post.options,
                is_anonymous: true,
                allows_multiple_answers: false,
              }
            : {
                chat_id: CHANNEL,
                text: post.text,
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: {
                  inline_keyboard: [[{ text: post.button, url: APP_URL }]],
                },
              };

        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as {
            ok: boolean;
            description?: string;
            result?: { message_id?: number };
          };

          if (!json.ok) {
            // Release the week so the next hourly run can retry.
            await supabaseAdmin.from("channel_post_runs").delete().eq("week_key", key);
            console.error("weekly channel post failed", json.description);
            return Response.json({ ok: false, error: json.description }, { status: 502 });
          }

          await supabaseAdmin
            .from("channel_post_runs")
            .update({ message_id: json.result?.message_id ?? null })
            .eq("week_key", key);

          return Response.json({ ok: true, week: key, kind: post.kind });
        } catch (error) {
          await supabaseAdmin.from("channel_post_runs").delete().eq("week_key", key);
          console.error("weekly channel post error", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
