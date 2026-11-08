import { createFileRoute } from "@tanstack/react-router";

// TonConnect requires an absolute manifest whose URL matches the origin the
// Mini App is served from (preview and published domains differ), so build it
// from the incoming request instead of shipping a static file.
export const Route = createFileRoute("/api/public/tonconnect-manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(
          JSON.stringify({
            url: origin,
            name: "Monsters Cards",
            iconUrl: `${origin}/favicon.png`,
          }),
          {
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
              "cache-control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
