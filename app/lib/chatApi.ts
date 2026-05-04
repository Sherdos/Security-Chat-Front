import type {
  Attachment,
  Chat,
  ChatMessage,
  Group,
  GroupMember,
  Notification,
  Topic,
  User,
  UserProfile,
} from "../types/chat";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);

export const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "");

export type Tokens = {
  access: string;
  refresh: string;
};

type RequestConfig = {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: BodyInit | null;
  headers?: Record<string, string>;
  token?: string | null;
};

type TokenRef = {
  get: () => Tokens | null;
  set: (tokens: Tokens | null) => void;
};

let refreshPromise: Promise<Tokens | null> | null = null;

export async function createRequest({
  endpoint,
  method = "GET",
  body,
  headers,
  token,
}: RequestConfig): Promise<Response> {
  return fetch(`${API_BASE}${endpoint}`, {
    method,
    body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });
}

export async function requestJson<T>(
  config: RequestConfig,
  tokenRef?: TokenRef,
): Promise<T> {
  const response = await createRequest(config);

  if (response.status === 401 && tokenRef) {
    const fresh = await refreshTokens(tokenRef);

    if (fresh?.access) {
      const retry = await createRequest({ ...config, token: fresh.access });
      if (!retry.ok) {
        throw new Error(await toErrorMessage(retry));
      }
      return (await retry.json()) as T;
    }
  }

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

type JsonMethod = "POST" | "PUT" | "PATCH";

function jsonBody(
  endpoint: string,
  method: JsonMethod,
  token: string,
  data: unknown,
): RequestConfig {
  return {
    endpoint,
    method,
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function multipartBody(
  endpoint: string,
  method: JsonMethod,
  token: string,
  form: FormData,
): RequestConfig {
  return { endpoint, method, token, body: form };
}

export async function login(
  username: string,
  password: string,
): Promise<Tokens> {
  return requestJson<Tokens>({
    endpoint: "/api/token/",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function register(
  username: string,
  email: string,
  password: string,
) {
  return requestJson({
    endpoint: "/api/users/register/",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function refreshTokens(
  tokenRef: TokenRef,
): Promise<Tokens | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const current = tokenRef.get();

    if (!current?.refresh) {
      tokenRef.set(null);
      return null;
    }

    const response = await fetch(`${API_BASE}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: current.refresh }),
    });

    if (!response.ok) {
      tokenRef.set(null);
      return null;
    }

    const data = (await response.json()) as { access: string };
    const updated = { ...current, access: data.access };
    tokenRef.set(updated);
    return updated;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// Bootstrap resources
export async function fetchMe(
  token: string,
  tokenRef: TokenRef,
): Promise<User> {
  return requestJson<User>({ endpoint: "/api/users/me/", token }, tokenRef);
}

export async function fetchUsers(
  token: string,
  tokenRef: TokenRef,
): Promise<User[]> {
  return requestJson<User[]>({ endpoint: "/api/users/list/", token }, tokenRef);
}

export async function searchUsers(
  token: string,
  tokenRef: TokenRef,
  query: string,
): Promise<User[]> {
  return requestJson<User[]>(
    { endpoint: `/api/users/search/?q=${encodeURIComponent(query)}`, token },
    tokenRef,
  );
}

export async function fetchDirectChats(
  token: string,
  tokenRef: TokenRef,
): Promise<Chat[]> {
  return requestJson<Chat[]>({ endpoint: "/api/chats/", token }, tokenRef);
}

export async function fetchGroups(
  token: string,
  tokenRef: TokenRef,
): Promise<Group[]> {
  return requestJson<Group[]>(
    { endpoint: "/api/chats/groups/", token },
    tokenRef,
  );
}

export async function fetchNotifications(
  token: string,
  tokenRef: TokenRef,
): Promise<Notification[]> {
  return requestJson<Notification[]>(
    { endpoint: "/api/chats/notifications/", token },
    tokenRef,
  );
}

// Profiles (§2.3–2.5)
export async function getMyProfile(
  token: string,
  tokenRef: TokenRef,
): Promise<UserProfile> {
  return requestJson<UserProfile>(
    { endpoint: "/api/users/me/profile/", token },
    tokenRef,
  );
}

export async function updateMyProfile(
  token: string,
  tokenRef: TokenRef,
  form: FormData,
): Promise<UserProfile> {
  return requestJson<UserProfile>(
    multipartBody("/api/users/me/profile/", "PUT", token, form),
    tokenRef,
  );
}

export async function getUserProfile(
  token: string,
  tokenRef: TokenRef,
  userId: number,
): Promise<UserProfile> {
  return requestJson<UserProfile>(
    { endpoint: `/api/users/${userId}/profile/`, token },
    tokenRef,
  );
}

// Public keys (§2.6)
export type PublicKeyPayload = {
  public_key: JsonWebKey | null;
};

export async function getMyPublicKey(
  token: string,
  tokenRef: TokenRef,
): Promise<PublicKeyPayload> {
  return requestJson<PublicKeyPayload>(
    { endpoint: "/api/users/me/public-key/", token },
    tokenRef,
  );
}

export async function setMyPublicKey(
  token: string,
  tokenRef: TokenRef,
  publicKey: JsonWebKey,
): Promise<PublicKeyPayload> {
  return requestJson<PublicKeyPayload>(
    jsonBody("/api/users/me/public-key/", "PUT", token, {
      public_key: publicKey,
    }),
    tokenRef,
  );
}

export async function getUserPublicKey(
  token: string,
  tokenRef: TokenRef,
  userId: number,
): Promise<PublicKeyPayload> {
  return requestJson<PublicKeyPayload>(
    { endpoint: `/api/users/${userId}/public-key/`, token },
    tokenRef,
  );
}

// Groups (§4.3–4.4)
export async function getGroupDetails(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
): Promise<Group> {
  return requestJson<Group>(
    { endpoint: `/api/chats/groups/${groupId}/`, token },
    tokenRef,
  );
}

export async function listGroupMembers(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
): Promise<GroupMember[]> {
  return requestJson<GroupMember[]>(
    { endpoint: `/api/chats/groups/${groupId}/members/`, token },
    tokenRef,
  );
}

export async function addGroupMember(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
  userId: number,
): Promise<GroupMember> {
  return requestJson<GroupMember>(
    jsonBody(`/api/chats/groups/${groupId}/members/`, "POST", token, {
      user_id: userId,
    }),
    tokenRef,
  );
}

export async function createGroup(
  token: string,
  tokenRef: TokenRef,
  form: FormData,
): Promise<Group> {
  return requestJson<Group>(
    multipartBody("/api/chats/groups/", "POST", token, form),
    tokenRef,
  );
}

// Group E2E key storage
export type GroupE2EKeyPayload = {
  ciphertext: string;
  iv: string;
  encrypted_by_id: number;
};

export async function getGroupEncryptedKey(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
): Promise<GroupE2EKeyPayload> {
  return requestJson<GroupE2EKeyPayload>(
    { endpoint: `/api/chats/groups/${groupId}/e2e-key/`, token },
    tokenRef,
  );
}

export async function setGroupEncryptedKey(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
  forUserId: number,
  ciphertext: string,
  iv: string,
): Promise<void> {
  await requestJson<{ status: string }>(
    jsonBody(`/api/chats/groups/${groupId}/e2e-key/`, "POST", token, {
      for_user_id: forUserId,
      ciphertext,
      iv,
    }),
    tokenRef,
  );
}

// Messages
export async function fetchMessages(
  token: string,
  tokenRef: TokenRef,
  endpoint: string,
): Promise<ChatMessage[]> {
  return requestJson<ChatMessage[]>({ endpoint, token }, tokenRef);
}

export async function sendMessageRest(
  token: string,
  tokenRef: TokenRef,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<ChatMessage> {
  return requestJson<ChatMessage>(
    jsonBody(endpoint, "POST", token, payload),
    tokenRef,
  );
}

// Topics
export async function createTopic(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
  title: string,
): Promise<Topic> {
  return requestJson<Topic>(
    jsonBody(`/api/chats/groups/${groupId}/topics/`, "POST", token, { title }),
    tokenRef,
  );
}

export async function fetchTopics(
  token: string,
  tokenRef: TokenRef,
  groupId: number,
): Promise<Topic[]> {
  return requestJson<Topic[]>(
    { endpoint: `/api/chats/groups/${groupId}/topics/`, token },
    tokenRef,
  );
}

// Attachments (§3.5)
export async function uploadAttachment(
  token: string,
  tokenRef: TokenRef,
  messageId: number,
  file: File,
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  // Explicitly declare audio so the server doesn't misclassify audio/webm as video.
  if (file.type.startsWith("audio/")) {
    form.append("attachment_type", "audio");
  }
  if (file.type.startsWith("image/")) {
    form.append("attachment_type", "image");
  }
  if (file.type.startsWith("video/")) {
    form.append("attachment_type", "video");
  }
  return requestJson<Attachment>(
    multipartBody(
      `/api/chats/messages/${messageId}/attachments/`,
      "POST",
      token,
      form,
    ),
    tokenRef,
  );
}

// Chat create (direct)
export async function createDirectChat(
  token: string,
  tokenRef: TokenRef,
  receiverUserId: number,
): Promise<Chat> {
  return requestJson<Chat>(
    jsonBody("/api/chats/", "POST", token, {
      receiver_user_id: receiverUserId,
    }),
    tokenRef,
  );
}

// Read receipts
export async function markMessageRead(
  token: string,
  tokenRef: TokenRef,
  messageId: number,
): Promise<void> {
  await requestJson(
    {
      endpoint: `/api/chats/messages/${messageId}/read/`,
      method: "POST",
      token,
    },
    tokenRef,
  );
}

// Notifications
export async function markNotificationRead(
  token: string,
  tokenRef: TokenRef,
  notificationId: number,
): Promise<void> {
  await requestJson(
    {
      endpoint: `/api/chats/notifications/${notificationId}/read/`,
      method: "POST",
      token,
    },
    tokenRef,
  );
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
    if (
      Array.isArray(payload.non_field_errors) &&
      payload.non_field_errors.length > 0
    ) {
      return String(payload.non_field_errors[0]);
    }
    return JSON.stringify(payload);
  } catch {
    return `Request failed with status ${response.status}`;
  }
}
