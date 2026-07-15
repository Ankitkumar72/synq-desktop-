import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encryptToken } from "../shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname; // e.g. /calendar-oauth/init or /calendar-oauth/callback

  // Standard CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  // Ensure user is authenticated for OAuth operations
  const authHeader = req.headers.get("Authorization") || "";
  
  // Create a client initialized with the user's JWT to enforce RLS
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }

  // -- Route: /init --
  // Returns the redirect URL for Google/Microsoft OAuth
  if (path.endsWith("/init")) {
    const provider = url.searchParams.get("provider");
    if (!provider) return new Response("Missing provider", { status: 400 });

    // TODO: Construct actual Google/Microsoft OAuth URL here
    // For now, return a dummy URL indicating where the frontend should redirect
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent`;

    return new Response(JSON.stringify({ redirectUrl }), {
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  // -- Route: /callback --
  // Exchanges code for tokens and encrypts them
  if (path.endsWith("/callback")) {
    try {
      const { code, provider } = await req.json();

      if (!code || !provider) {
        return new Response("Missing code or provider", { status: 400 });
      }

      // TODO: Exchange code for token with Google/Microsoft
      // Mocking the exchange response for demonstration
      const mockExchange = {
        access_token: "ya29.a0AfB_by...",
        refresh_token: "1//04...",
        email: "user@example.com"
      };

      // Encrypt the tokens natively in memory using Web Crypto API
      // Binding them to the user_id and provider (AAD)
      const encryptedAccess = await encryptToken(mockExchange.access_token, user.id, provider);
      
      let encryptedRefresh = null;
      if (mockExchange.refresh_token) {
         encryptedRefresh = await encryptToken(mockExchange.refresh_token, user.id, provider);
      }

      // Insert into the database using the user's RLS-bound client
      const { error: dbError } = await userClient.from("calendar_accounts").upsert({
        user_id: user.id,
        provider: provider,
        account_email: mockExchange.email,
        access_token: encryptedAccess.ciphertext,
        access_token_iv: encryptedAccess.iv,
        access_token_tag: encryptedAccess.tag,
        refresh_token: encryptedRefresh?.ciphertext || null,
        refresh_token_iv: encryptedRefresh?.iv || null,
        refresh_token_tag: encryptedRefresh?.tag || null,
        key_version: encryptedAccess.keyVersion
      }, { onConflict: "user_id, provider" });

      if (dbError) {
        console.error("Database insert failed:", dbError);
        return new Response(JSON.stringify({ error: "Failed to store account" }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ success: true, email: mockExchange.email }), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
      
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers });
    }
  }

  return new Response("Not found", { status: 404 });
});
