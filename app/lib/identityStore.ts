const LS_KEY = "oc:identity:v2";

type StoredIdentity = {
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
};

export type LocalIdentity = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
};

export function hasStoredIdentity(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

export async function loadIdentity(): Promise<LocalIdentity | null> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const stored: StoredIdentity = JSON.parse(raw);

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      stored.privateJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey", "deriveBits"],
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      stored.publicJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    );
    return { privateKey, publicKey, publicJwk: stored.publicJwk };
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
}): Promise<LocalIdentity> {
  const privateJwk = (await crypto.subtle.exportKey("jwk", identity.privateKey)) as JsonWebKey;
  const stored: StoredIdentity = { privateJwk, publicJwk: identity.publicJwk };
  localStorage.setItem(LS_KEY, JSON.stringify(stored));

  // Re-import private key as non-extractable for in-memory use
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
  return { privateKey, publicKey: identity.publicKey, publicJwk: identity.publicJwk };
}

export function clearIdentity(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

export function publicKeysEqual(
  a: JsonWebKey | null | undefined,
  b: JsonWebKey | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.crv === b.crv && a.x === b.x && a.y === b.y && a.kty === b.kty;
}
