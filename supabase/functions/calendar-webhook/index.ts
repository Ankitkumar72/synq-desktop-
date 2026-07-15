import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // Webhooks from Microsoft Graph or Google Calendar are POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider"); // e.g., ?provider=google

    if (!provider) {
      return new Response("Missing provider", { status: 400 });
    }

    let channelId = null;

    // 1. Parse based on provider specifics
    if (provider === "google") {
      channelId = req.headers.get("x-goog-channel-id");
      // The body is usually empty for push notifications, but we need the channel ID
      if (!channelId) {
        return new Response("Missing channel id", { status: 400 });
      }
    } else if (provider === "outlook") {
      // Microsoft Graph validation payload (they send a validation token when subscribing)
      const validationToken = url.searchParams.get("validationToken");
      if (validationToken) {
        return new Response(validationToken, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // Graph normal notification payload
      const payload = await req.json();
      if (payload?.value && payload.value.length > 0) {
        channelId = payload.value[0].subscriptionId;
      }
      
      if (!channelId) {
         return new Response("Missing subscription id", { status: 400 });
      }
    } else {
      return new Response("Unsupported provider", { status: 400 });
    }

    // 2. Enqueue - fast, single insert, nothing async-risky
    // The pg_net trigger on this table will instantly notify the worker.
    const { error } = await supabase.from("sync_jobs").insert({
      channel_id: channelId,
      status: "pending",
    });

    if (error) {
      console.error("Failed to enqueue sync job:", error);
      // Still return 200 so the provider doesn't think the endpoint is dead,
      // but ideally we wouldn't drop this.
    }

    // 3. Ack immediately - well under Microsoft's 3s / Google's timeout
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook processing error:", err);
    // Returning 200 even on error prevents webhook providers from immediately punishing the endpoint,
    // though debugging will require checking edge function logs.
    return new Response("OK", { status: 200 });
  }
});
