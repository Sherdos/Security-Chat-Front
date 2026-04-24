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
