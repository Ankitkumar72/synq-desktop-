import { decryptToken, encryptToken, EncryptedPayload } from "../crypto.ts";

export interface FetchDeltaParams {
  accessToken: string;
  encryptedRefreshToken: Omit<EncryptedPayload, 'keyVersion'> | null;
  userId: string;
  syncToken?: string;
  clientId: string; // Google OAuth Client ID
  clientSecret: string; // Google OAuth Client Secret
}

export interface FetchDeltaResult {
  events: any[];
  nextSyncToken: string | null;
  newEncryptedAccessToken?: EncryptedPayload;
}

/**
 * Fetches delta changes from Google Calendar.
 * Automatically handles pagination and access token refreshing.
 */
export async function fetchGoogleCalendarDeltas(params: FetchDeltaParams): Promise<FetchDeltaResult> {
  let { accessToken } = params;
  let newEncryptedAccessToken: EncryptedPayload | undefined;
  
  // Helper to make the API call
  const makeRequest = async (token: string, pageToken?: string) => {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.append("maxResults", "2500");
    
    if (params.syncToken && !pageToken) {
      url.searchParams.append("syncToken", params.syncToken);
    }
    if (pageToken) {
      url.searchParams.append("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      return { error: 401 };
    }
    
    if (response.status === 410) {
      // 410 Gone means the syncToken is fully invalidated by Google (e.g., too old)
      // We must drop the syncToken and perform a full sync.
      return { error: 410 };
    }

    if (!response.ok) {
      throw new Error(`Google API Error: ${response.status} - ${await response.text()}`);
    }

    return { data: await response.json() };
  };

  let res = await makeRequest(accessToken);

  // Handle Token Expiry
  if (res.error === 401) {
    if (!params.encryptedRefreshToken) {
      throw new Error("Access token expired and no refresh token available.");
    }
    
    console.log(`Refreshing Google token for user ${params.userId}`);
    const refreshToken = await decryptToken(params.encryptedRefreshToken, params.userId, "google");
    
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh Google token. The user may have revoked access.");
    }

    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;
    
    // Encrypt the new access token before returning it
    newEncryptedAccessToken = await encryptToken(accessToken, params.userId, "google");
    
    // Retry the request with the fresh token
    res = await makeRequest(accessToken);
    if (res.error) {
      throw new Error(`Failed to fetch events even after refresh: ${res.error}`);
    }
  }

  // Handle 410 Gone (Full Sync Required)
  if (res.error === 410) {
    console.log(`SyncToken expired for user ${params.userId}. Initiating full sync.`);
    // Omit the syncToken to force a full sync
    params.syncToken = undefined;
    res = await makeRequest(accessToken);
    if (res.error) {
      throw new Error(`Failed to fetch events on full sync fallback: ${res.error}`);
    }
  }

  const events: any[] = [];
  let currentData = res.data;
  
  // Aggregate pages
  while (true) {
    if (currentData.items && currentData.items.length > 0) {
      events.push(...currentData.items);
    }

    if (currentData.nextPageToken) {
      const pageRes = await makeRequest(accessToken, currentData.nextPageToken);
      if (pageRes.error) throw new Error("Pagination failed");
      currentData = pageRes.data;
    } else {
      break;
    }
  }

  return {
    events,
    nextSyncToken: currentData.nextSyncToken || null,
    newEncryptedAccessToken
  };
}
