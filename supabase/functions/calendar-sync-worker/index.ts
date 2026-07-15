import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { decryptToken } from "../shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// We use the service_role key because this is an internal worker triggered by pg_net
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // pg_net sends a POST request with the new row's ID
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { job_id } = await req.json();
    if (!job_id) return new Response("Missing job_id", { status: 400 });

    // 1. Claim the job (prevent concurrent processing if we ever poll)
    const { data: job, error: jobError } = await supabase
      .from("sync_jobs")
      .update({ status: "processing" })
      .eq("id", job_id)
      .eq("status", "pending")
      .select()
      .single();

    if (jobError || !job) {
      return new Response("Job not found or already processing", { status: 200 });
    }

    // 2. Find the subscription to identify the user
    const { data: sub, error: subError } = await supabase
      .from("calendar_subscriptions")
      .select("user_id, provider, resource_id")
      .eq("channel_id", job.channel_id)
      .single();

    if (subError || !sub) {
      await supabase.from("sync_jobs").update({ status: "failed", error_details: "Subscription not found" }).eq("id", job_id);
      return new Response("Subscription not found", { status: 200 });
    }

    // 3. Fetch the user's encrypted tokens
    const { data: account, error: accError } = await supabase
      .from("calendar_accounts")
      .select("*")
      .eq("user_id", sub.user_id)
      .eq("provider", sub.provider)
      .single();

    if (accError || !account) {
       await supabase.from("sync_jobs").update({ status: "failed", error_details: "Account missing" }).eq("id", job_id);
       return new Response("Account not found", { status: 200 });
    }

    // 4. Decrypt the access token securely using AAD
    let accessToken: string;
    try {
      accessToken = await decryptToken(
        {
          ciphertext: account.access_token,
          iv: account.access_token_iv,
          tag: account.access_token_tag
        },
        sub.user_id,
        sub.provider
      );
    } catch (cryptoErr) {
      console.error("Decryption failed:", cryptoErr);
      await supabase.from("sync_jobs").update({ status: "failed", error_details: "Decryption failed" }).eq("id", job_id);
      return new Response("Decryption error", { status: 200 });
    }

    // 5. Fetch the user's latest syncToken
    const { data: syncState } = await supabase
      .from("sync_tokens")
      .select("sync_token")
      .eq("user_id", sub.user_id)
      .eq("provider", sub.provider)
      .single();

    // 6. Perform the Delta Sync with the Provider
    console.log(`Performing delta sync for user ${sub.user_id} on ${sub.provider} using token ${syncState?.sync_token || 'INITIAL'}`);
    
    if (sub.provider === "google") {
      const { fetchGoogleCalendarDeltas } = await import("../shared/providers/google.ts");
      
      const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
      const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

      let encryptedRefreshToken = null;
      if (account.refresh_token && account.refresh_token_iv && account.refresh_token_tag) {
        encryptedRefreshToken = {
          ciphertext: account.refresh_token,
          iv: account.refresh_token_iv,
          tag: account.refresh_token_tag
        };
      }

      try {
        const deltaResult = await fetchGoogleCalendarDeltas({
          accessToken,
          encryptedRefreshToken,
          userId: sub.user_id,
          syncToken: syncState?.sync_token,
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET
        });

        // 6.1 If access token was refreshed, save it
        if (deltaResult.newEncryptedAccessToken) {
          await supabase.from("calendar_accounts").update({
            access_token: deltaResult.newEncryptedAccessToken.ciphertext,
            access_token_iv: deltaResult.newEncryptedAccessToken.iv,
            access_token_tag: deltaResult.newEncryptedAccessToken.tag,
            key_version: deltaResult.newEncryptedAccessToken.keyVersion
          }).eq("id", account.id);
        }

        // 6.2 Process events and map to CRDT operations
        const hlc_timestamp = new Date().toISOString();

        for (const gEvent of deltaResult.events) {
          // Find mapping or create one
          let mappedEventId: string;
          const { data: mapping } = await supabase
            .from("external_event_mappings")
            .select("event_id")
            .eq("provider", "google")
            .eq("external_event_id", gEvent.id)
            .single();

          if (mapping) {
            mappedEventId = mapping.event_id;
          } else {
            mappedEventId = crypto.randomUUID(); // Deno's native UUID generator
            await supabase.from("external_event_mappings").insert({
              user_id: sub.user_id,
              event_id: mappedEventId,
              provider: "google",
              external_event_id: gEvent.id
            });
          }

          // Build CRDT field deltas
          const isDeleted = gEvent.status === "cancelled";
          const field_deltas = {
            title: gEvent.summary || "Untitled Event",
            description: gEvent.description || "",
            start_date: gEvent.start?.dateTime || gEvent.start?.date,
            end_date: gEvent.end?.dateTime || gEvent.end?.date,
            is_deleted: isDeleted
          };

          // Invoke the Postgres RPC
          const { error: rpcError } = await supabase.rpc("apply_event_crdt_update", {
            p_event_id: mappedEventId,
            p_field_deltas: field_deltas,
            p_hlc_timestamp: hlc_timestamp,
            p_user_id: sub.user_id
          });

          if (rpcError) {
             console.error("Failed to apply CRDT update for event", gEvent.id, rpcError);
          }
        }

        // 6.3 Save new syncToken
        if (deltaResult.nextSyncToken) {
          await supabase.from("sync_tokens").upsert({
            user_id: sub.user_id,
            provider: "google",
            sync_token: deltaResult.nextSyncToken
          }, { onConflict: "user_id, provider" });
        }

      } catch (syncErr) {
        console.error("Google Delta Sync failed:", syncErr);
        await supabase.from("sync_jobs").update({ status: "failed", error_details: syncErr.message }).eq("id", job_id);
        return new Response("Sync error", { status: 200 });
      }
    }

    // 7. Mark job as completed
    await supabase.from("sync_jobs").update({ status: "completed" }).eq("id", job_id);

    return new Response("OK", { status: 200 });
    
  } catch (err) {
    console.error("Worker error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
