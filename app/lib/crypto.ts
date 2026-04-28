const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const LEGACY_SALT = "onlinechat-app-salt-v1";
const ITERATIONS = 120000;

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
};

export type IdentityKeyPair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
};

export async function encryptMessage(
  plainText: string,
  passphrase: string,
  saltString: string = LEGACY_SALT,
): Promise<EncryptedPayload> {
  const key = await deriveAesKey(passphrase, saltString);
  return encryptWithKey(key, plainText);
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  passphrase: string,
  saltString: string = LEGACY_SALT,
): Promise<string> {
  const key = await deriveAesKey(passphrase, saltString);
  return decryptWithKey(key, ciphertext, iv);
}

export async function encryptWithKey(
  key: CryptoKey,
  plainText: string,
): Promise<EncryptedPayload> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    textEncoder.encode(plainText),
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(ivBytes),
  };
}

export async function decryptWithKey(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const cipherBytes = base64ToBytes(ciphertext);
  const ivBytes = base64ToBytes(iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    key,
    cipherBytes as BufferSource,
  );

  return textDecoder.decode(decrypted);
}

async function deriveAesKey(
  passphrase: string,
  saltString: string,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textEncoder.encode(saltString),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  )) as CryptoKeyPair;

  const publicJwk = (await crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  )) as JsonWebKey;

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
  };
}

export async function importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// P-256 group order — private key scalar must be in [1, ORDER-1]
const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const b of bytes) result = (result << 8n) | BigInt(b);
  return result;
}

function bigIntToBytes32(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, "0");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Derives a deterministic P-256 ECDH key pair from a mnemonic phrase via PBKDF2.
 * Uses @noble/curves for cross-browser EC scalar multiplication (public-key derivation).
 * Same phrase → same key on any device.
 */
export async function deriveKeyPairFromMnemonic(mnemonic: string): Promise<IdentityKeyPair> {
  const { p256 } = await import("@noble/curves/nist.js");

  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(mnemonic.trim()),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const privateKeyBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: textEncoder.encode("onlinechat-id-v2"), iterations: 200000, hash: "SHA-256" },
    baseKey,
    256,
  );

  // Reduce mod P-256 order so the scalar is always valid for WebCrypto
  const rawScalar = bytesToBigInt(new Uint8Array(privateKeyBits));
  const normalizedScalar = ((rawScalar % P256_ORDER) + P256_ORDER) % P256_ORDER || 1n;
  const privateBytes = bigIntToBytes32(normalizedScalar);

  // Compute the public key (uncompressed: 04 || x || y) using @noble/curves
  const publicUncompressed = p256.getPublicKey(privateBytes, false);
  const xBytes = publicUncompressed.slice(1, 33);
  const yBytes = publicUncompressed.slice(33, 65);

  const toBase64url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const dB64 = toBase64url(privateBytes);
  const xB64 = toBase64url(xBytes);
  const yB64 = toBase64url(yBytes);

  const publicJwk: JsonWebKey = { kty: "EC", crv: "P-256", x: xB64, y: yB64 };

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: dB64, x: xB64, y: yB64, ext: true },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  return { privateKey, publicKey, publicJwk };
}

/** Generates a fresh random AES-256-GCM key for a group. */
export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  ) as Promise<CryptoKey>;
}

/** Encrypts a group AES key using the ECDH-derived wrap key. */
export async function encryptGroupKey(groupKey: CryptoKey, wrapKey: CryptoKey): Promise<EncryptedPayload> {
  const rawBytes = new Uint8Array(await crypto.subtle.exportKey("raw", groupKey));
  return encryptWithKey(wrapKey, bytesToBase64(rawBytes));
}

/** Decrypts a group AES key from an EncryptedPayload using the ECDH-derived wrap key. */
export async function decryptGroupKey(payload: EncryptedPayload, wrapKey: CryptoKey): Promise<CryptoKey> {
  const base64 = await decryptWithKey(wrapKey, payload.ciphertext, payload.iv);
  const rawBytes = base64ToBytes(base64);
  return crypto.subtle.importKey(
    "raw",
    rawBytes.buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  ) as Promise<CryptoKey>;
}

export function roomSalt(
  kind: "direct" | "group" | "topic",
  ids: { groupId?: number | null; topicId?: number | null; chatId?: number | null },
): string {
  if (kind === "topic" && ids.groupId && ids.topicId) {
    return `topic:${ids.groupId}:${ids.topicId}`;
  }
  if (kind === "group" && ids.groupId) {
    return `group:${ids.groupId}`;
  }
  if (kind === "direct" && ids.chatId) {
    return `direct:${ids.chatId}`;
  }
  return LEGACY_SALT;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  value.forEach((currentByte) => {
    binary += String.fromCharCode(currentByte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}
