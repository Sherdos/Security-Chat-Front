const DB_NAME = "onlinechatfront-identity";
const STORE_NAME = "keys";
const KEY_ID = "identity";

type StoredIdentity = {
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = fn(store);
    transaction.oncomplete = () => {
      resolve(request ? (request.result as T) : undefined);
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readStored(): Promise<StoredIdentity | null> {
  try {
    const result = await tx<StoredIdentity>("readonly", (store) =>
      store.get(KEY_ID),
    );
    return result ?? null;
  } catch {
    return null;
  }
}

async function writeStored(value: StoredIdentity): Promise<void> {
  await tx("readwrite", (store) => store.put(value, KEY_ID));
}

export type LocalIdentity = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
};

export async function loadIdentity(): Promise<LocalIdentity | null> {
  const stored = await readStored();
  if (!stored) {
    return null;
  }
  try {
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
  const privateJwk = (await crypto.subtle.exportKey(
    "jwk",
    identity.privateKey,
  )) as JsonWebKey;
  await writeStored({ privateJwk, publicJwk: identity.publicJwk });

  const reloadedPrivate = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );

  return {
    privateKey: reloadedPrivate,
    publicKey: identity.publicKey,
    publicJwk: identity.publicJwk,
  };
}

export function publicKeysEqual(
  a: JsonWebKey | null | undefined,
  b: JsonWebKey | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.crv === b.crv && a.x === b.x && a.y === b.y && a.kty === b.kty;
}
