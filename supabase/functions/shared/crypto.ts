const ENVIRONMENT = Deno.env.get("ENVIRONMENT") || "local";
const CALENDAR_ENCRYPTION_KEY = Deno.env.get("CALENDAR_ENCRYPTION_KEY");

if (!CALENDAR_ENCRYPTION_KEY) {
  throw new Error("CALENDAR_ENCRYPTION_KEY environment variable is missing.");
}

// Startup guard to prevent accidental production deployments of mock keys
if (ENVIRONMENT !== "local" && CALENDAR_ENCRYPTION_KEY.startsWith("MOCK_MASTER_KEY_")) {
  throw new Error("Refusing to start: mock key detected in non-local environment");
}

// For mock keys, strip the prefix before importing
const rawBase64Key = CALENDAR_ENCRYPTION_KEY.startsWith("MOCK_MASTER_KEY_")
  ? CALENDAR_ENCRYPTION_KEY.replace("MOCK_MASTER_KEY_", "")
  : CALENDAR_ENCRYPTION_KEY;

let masterCryptoKey: CryptoKey | null = null;

async function getMasterKey(): Promise<CryptoKey> {
  if (masterCryptoKey) return masterCryptoKey;
  
  const keyBuffer = Uint8Array.from(atob(rawBase64Key), c => c.charCodeAt(0));
  masterCryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
  return masterCryptoKey;
}

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64
  tag: string;        // Base64
  keyVersion: number;
}

/**
 * Encrypts a string using AES-256-GCM envelope encryption.
 * Binds the encryption to the user and provider via Associated Authenticated Data (AAD).
 */
export async function encryptToken(
  plaintext: string,
  userId: string,
  provider: string
): Promise<EncryptedPayload> {
  const key = await getMasterKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // 96-bit random IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // AAD prevents swapping ciphertexts between users/providers
  const aad = encoder.encode(`${userId}:${provider}`);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad,
      tagLength: 128 // 16 bytes auth tag
    },
    key,
    data
  );

  // Web Crypto API appends the authentication tag to the end of the ciphertext.
  // We need to slice it off to store it separately as requested in the architecture.
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const tagLengthBytes = 16;
  const ciphertextBytes = encryptedArray.slice(0, encryptedArray.length - tagLengthBytes);
  const tagBytes = encryptedArray.slice(encryptedArray.length - tagLengthBytes);

  return {
    ciphertext: btoa(String.fromCharCode(...ciphertextBytes)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tagBytes)),
    keyVersion: 1 // Hardcoded to v1 for now
  };
}

/**
 * Decrypts a token encrypted via AES-256-GCM.
 * Validates the AAD to ensure the token actually belongs to the requesting user/provider.
 */
export async function decryptToken(
  payload: Omit<EncryptedPayload, 'keyVersion'>,
  userId: string,
  provider: string
): Promise<string> {
  const key = await getMasterKey();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(payload.tag), c => c.charCodeAt(0));
  const aad = encoder.encode(`${userId}:${provider}`);

  // Re-concatenate ciphertext and tag for the Web Crypto API decryption
  const combinedBuffer = new Uint8Array(ciphertext.length + tag.length);
  combinedBuffer.set(ciphertext, 0);
  combinedBuffer.set(tag, ciphertext.length);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: aad,
        tagLength: 128
      },
      key,
      combinedBuffer
    );
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Decryption failed (Possible tampering or wrong AAD): ${errorMessage}`);
  }
}
