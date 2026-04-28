import { useCallback, useRef } from "react";
import {
  addGroupMember,
  createDirectChat,
  createGroup,
  createTopic as createTopicApi,
  fetchDirectChats,
  fetchGroups,
  fetchMe,
  fetchMessages,
  fetchNotifications,
  fetchTopics,
  fetchUsers,
  getGroupDetails,
  getGroupEncryptedKey,
  getMyProfile,
  getMyPublicKey,
  getUserProfile,
  getUserPublicKey,
  listGroupMembers,
  login,
  markNotificationRead,
  register,
  sendMessageRest,
  setGroupEncryptedKey,
  setMyPublicKey,
  updateMyProfile,
  uploadAttachment,
} from "../lib/chatApi";
import { getMessageKey } from "../lib/chatMessage";
import {
  decryptGroupKey,
  decryptWithKey,
  deriveKeyPairFromMnemonic,
  deriveSharedKey,
  encryptGroupKey,
  encryptWithKey,
  generateGroupKey,
  importPublicJwk,
} from "../lib/crypto";
import {
  loadIdentity,
  publicKeysEqual,
  saveIdentity,
  type LocalIdentity,
} from "../lib/identityStore";
import { useChatStore } from "../store/chatStore";
import { useTokenStore, type TokenStore } from "./useTokenStore";
import type {
  Attachment,
  ChatMessage,
  GroupMember,
  UserProfile,
} from "../types/chat";

function normalizeNestedProfile(nested: UserProfile): UserProfile {
  return {
    avatar: nested.avatar_url ?? nested.avatar ?? null,
    description: nested.description,
    status: nested.status,
    username: nested.username,
    created_at: nested.created_at,
  };
}

type UseChatActionsParams = {
  tokenRef: React.RefObject<{ access: string; refresh: string } | null>;
  tokenStore: TokenStore;
  wsRef: React.RefObject<WebSocket | null>;
  disconnectSocket: () => void;
  applyIncomingMessage: (incoming: ChatMessage) => void;
  setDecryptedText: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
};

export function useChatActions({
  tokenRef,
  tokenStore,
  wsRef,
  disconnectSocket,
  applyIncomingMessage,
  setDecryptedText,
}: UseChatActionsParams) {
  const { setTokens } = useTokenStore();

  const me = useChatStore((state) => state.me);
  const groups = useChatStore((state) => state.groups);
  const roomType = useChatStore((state) => state.roomType);
  const activeDirectId = useChatStore((state) => state.activeDirectId);
  const activeGroupId = useChatStore((state) => state.activeGroupId);
  const activeTopicId = useChatStore((state) => state.activeTopicId);
  const selectedUserId = useChatStore((state) => state.selectedUserId);
  const directChats = useChatStore((state) => state.directChats);
  const createGroupName = useChatStore((state) => state.createGroupName);
  const createGroupDescription = useChatStore(
    (state) => state.createGroupDescription,
  );
  const createGroupIsSupergroup = useChatStore(
    (state) => state.createGroupIsSupergroup,
  );
  const createGroupAvatar = useChatStore((state) => state.createGroupAvatar);
  const newTopicTitle = useChatStore((state) => state.newTopicTitle);
  const messageInput = useChatStore((state) => state.messageInput);
  const authMode = useChatStore((state) => state.authMode);
  const username = useChatStore((state) => state.username);
  const email = useChatStore((state) => state.email);
  const password = useChatStore((state) => state.password);
  const publicKeys = useChatStore((state) => state.publicKeys);
  const pendingAttachments = useChatStore((state) => state.pendingAttachments);

  const setError = useChatStore((state) => state.setError);
  const setStatus = useChatStore((state) => state.setStatus);
  const setMe = useChatStore((state) => state.setMe);
  const setUsers = useChatStore((state) => state.setUsers);
  const setNotifications = useChatStore((state) => state.setNotifications);
  const setDirectChats = useChatStore((state) => state.setDirectChats);
  const setGroups = useChatStore((state) => state.setGroups);
  const setTopics = useChatStore((state) => state.setTopics);
  const setMessages = useChatStore((state) => state.setMessages);
  const setRoomType = useChatStore((state) => state.setRoomType);
  const setActiveDirectId = useChatStore((state) => state.setActiveDirectId);
  const setActiveTopicId = useChatStore((state) => state.setActiveTopicId);
  const setCreateGroupName = useChatStore((state) => state.setCreateGroupName);
  const setCreateGroupDescription = useChatStore(
    (state) => state.setCreateGroupDescription,
  );
  const setCreateGroupIsSupergroup = useChatStore(
    (state) => state.setCreateGroupIsSupergroup,
  );
  const setCreateGroupAvatar = useChatStore(
    (state) => state.setCreateGroupAvatar,
  );
  const setNewTopicTitle = useChatStore((state) => state.setNewTopicTitle);
  const setMessageInput = useChatStore((state) => state.setMessageInput);
  const setMyProfile = useChatStore((state) => state.setMyProfile);
  const upsertUserProfile = useChatStore((state) => state.upsertUserProfile);
  const upsertGroupDetails = useChatStore((state) => state.upsertGroupDetails);
  const setGroupMembers = useChatStore((state) => state.setGroupMembers);
  const appendGroupMember = useChatStore((state) => state.appendGroupMember);
  const setPublicKey = useChatStore((state) => state.setPublicKey);
  const setPendingAttachment = useChatStore(
    (state) => state.setPendingAttachment,
  );
  const setMnemonicRequired = useChatStore((state) => state.setMnemonicRequired);

  // In-memory identity + ECDH/group key caches (per-tab lifetime)
  const identityRef = useRef<LocalIdentity | null>(null);
  const sharedKeyCache = useRef<Map<number, CryptoKey>>(new Map());
  const groupKeyCache = useRef<Map<number, CryptoKey>>(new Map());

  const ensureIdentity = useCallback(async (): Promise<LocalIdentity | null> => {
    if (identityRef.current) return identityRef.current;
    const access = tokenRef.current?.access;
    if (!access) return null;

    try {
      const local = await loadIdentity();
      if (!local) {
        // No key in localStorage — ask user for their secret words
        setMnemonicRequired(true);
        return null;
      }
      identityRef.current = local;

      const remote = await getMyPublicKey(access, tokenStore);
      if (!publicKeysEqual(remote.public_key, local.publicJwk)) {
        await setMyPublicKey(access, tokenStore, local.publicJwk);
      }
      return local;
    } catch {
      return null;
    }
  }, [tokenRef, tokenStore, setMnemonicRequired]);

  const resolvePeerId = useCallback((): number | null => {
    if (!activeDirectId || !me) return null;
    const chat = directChats.find((entry) => entry.id === activeDirectId);
    if (!chat) return null;
    if (chat.sender_user_id !== undefined && chat.receiver_user_id !== undefined) {
      return chat.sender_user_id === me.id ? chat.receiver_user_id : chat.sender_user_id;
    }
    const peer = chat.participants?.find((user) => user.id !== me.id);
    return peer?.id ?? null;
  }, [activeDirectId, directChats, me]);

  const getOrDerivePeerKey = useCallback(
    async (peerId: number): Promise<CryptoKey | null> => {
      const cached = sharedKeyCache.current.get(peerId);
      if (cached) return cached;

      const identity = await ensureIdentity();
      if (!identity) return null;

      const access = tokenRef.current?.access;
      if (!access) return null;

      let peerJwk = publicKeys[peerId];
      if (!peerJwk) {
        try {
          const response = await getUserPublicKey(access, tokenStore, peerId);
          if (!response.public_key) return null;
          peerJwk = response.public_key;
          setPublicKey(peerId, peerJwk);
        } catch {
          return null;
        }
      }

      try {
        const peerPublic = await importPublicJwk(peerJwk);
        const shared = await deriveSharedKey(identity.privateKey, peerPublic);
        sharedKeyCache.current.set(peerId, shared);
        return shared;
      } catch {
        return null;
      }
    },
    [ensureIdentity, publicKeys, setPublicKey, tokenRef, tokenStore],
  );

  const setupIdentityFromMnemonic = useCallback(
    async (mnemonic: string): Promise<string | null> => {
      try {
        const derived = await deriveKeyPairFromMnemonic(mnemonic);
        const local = await saveIdentity(derived);
        identityRef.current = local;

        const access = tokenRef.current?.access;
        if (access) {
          try {
            await setMyPublicKey(access, tokenStore, local.publicJwk);
          } catch {
            // Non-fatal — ensureIdentity will retry on next bootstrap
          }
        }
        setMnemonicRequired(false);
        setDecryptedText({});
        return null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to set up identity";
        setError(msg);
        return msg;
      }
    },
    [tokenRef, tokenStore, setMnemonicRequired, setError, setDecryptedText],
  );

  const getOrDeriveGroupKey = useCallback(
    async (groupId: number): Promise<CryptoKey | null> => {
      const cached = groupKeyCache.current.get(groupId);
      if (cached) return cached;

      const identity = await ensureIdentity();
      if (!identity) return null;
      const access = tokenRef.current?.access;
      if (!access || !me) return null;

      let groupKey: CryptoKey;

      try {
        const keyData = await getGroupEncryptedKey(access, tokenStore, groupId);
        // Decrypt the wrapped group key using ECDH shared secret with the distributor
        let encryptorPublic: CryptoKey;
        if (keyData.encrypted_by_id === me.id) {
          encryptorPublic = identity.publicKey;
        } else {
          let encryptorJwk = publicKeys[keyData.encrypted_by_id];
          if (!encryptorJwk) {
            const resp = await getUserPublicKey(access, tokenStore, keyData.encrypted_by_id);
            if (!resp.public_key) return null;
            encryptorJwk = resp.public_key;
            setPublicKey(keyData.encrypted_by_id, encryptorJwk);
          }
          encryptorPublic = await importPublicJwk(encryptorJwk);
        }
        const wrapKey = await deriveSharedKey(identity.privateKey, encryptorPublic);
        groupKey = await decryptGroupKey({ ciphertext: keyData.ciphertext, iv: keyData.iv }, wrapKey);
      } catch {
        // No key on server yet — generate one encrypted for ourselves
        groupKey = await generateGroupKey();
        const selfWrapKey = await deriveSharedKey(identity.privateKey, identity.publicKey);
        const encrypted = await encryptGroupKey(groupKey, selfWrapKey);
        await setGroupEncryptedKey(access, tokenStore, groupId, me.id, encrypted.ciphertext, encrypted.iv);
      }

      groupKeyCache.current.set(groupId, groupKey);
      return groupKey;
    },
    [ensureIdentity, tokenRef, tokenStore, me, publicKeys, setPublicKey],
  );

  const bootstrap = useCallback(async () => {
    const access = tokenRef.current?.access;
    if (!access) return;

    try {
      setStatus("Loading user data...");
      const [meRes, usersRes, chatsRes, groupsRes, notificationsRes] =
        await Promise.all([
          fetchMe(access, tokenStore),
          fetchUsers(access, tokenStore),
          fetchDirectChats(access, tokenStore),
          fetchGroups(access, tokenStore),
          fetchNotifications(access, tokenStore),
        ]);

      setMe(meRes);
      setUsers(usersRes);
      setDirectChats(chatsRes);
      setGroups(groupsRes);
      setNotifications(notificationsRes);

      // Seed userProfiles from nested user objects returned by the chats endpoint
      chatsRes.forEach((chat) => {
        if (chat.sender_user_id && chat.sender_user) {
          upsertUserProfile(chat.sender_user_id, normalizeNestedProfile(chat.sender_user));
        }
        if (chat.receiver_user_id && chat.receiver_user) {
          upsertUserProfile(chat.receiver_user_id, normalizeNestedProfile(chat.receiver_user));
        }
      });

      try {
        const profile = await getMyProfile(access, tokenStore);
        setMyProfile(profile);
      } catch {
        setMyProfile({ avatar: null, description: "", status: "" });
      }

      await ensureIdentity();
      setStatus("Ready");
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load data",
      );
      setStatus("");
    }
  }, [
    tokenRef,
    tokenStore,
    setMe,
    setUsers,
    setDirectChats,
    setGroups,
    setNotifications,
    setMyProfile,
    setStatus,
    setError,
    ensureIdentity,
  ]);

  const loadMessages = useCallback(async () => {
    const access = tokenRef.current?.access;
    if (!access) return;

    const endpoint =
      roomType === "direct"
        ? activeDirectId
          ? `/api/chats/${activeDirectId}/messages/`
          : null
        : activeGroupId
          ? `/api/chats/groups/${activeGroupId}/messages/${
              activeTopicId ? `?topic_id=${activeTopicId}` : ""
            }`
          : null;

    if (!endpoint) {
      setMessages([]);
      return;
    }

    try {
      const response = await fetchMessages(access, tokenStore, endpoint);
      setMessages(response);
      setDecryptedText({});
      setError("");

      // Seed userProfiles from nested user objects in message history
      response.forEach((msg) => {
        if (msg.sender_user_id && msg.sender_user) {
          upsertUserProfile(msg.sender_user_id, normalizeNestedProfile(msg.sender_user));
        }
        if (msg.receiver_user_id && msg.receiver_user) {
          upsertUserProfile(msg.receiver_user_id, normalizeNestedProfile(msg.receiver_user));
        }
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load message history",
      );
    }
  }, [
    roomType,
    activeDirectId,
    activeGroupId,
    activeTopicId,
    tokenRef,
    tokenStore,
    setMessages,
    setDecryptedText,
    setError,
    upsertUserProfile,
  ]);

  const loadTopics = useCallback(async () => {
    const access = tokenRef.current?.access;
    if (!activeGroupId || !access) {
      setTopics([]);
      setActiveTopicId(null);
      return;
    }

    const selected = groups.find((group) => group.id === activeGroupId);
    if (!selected?.is_supergroup) {
      setTopics([]);
      setActiveTopicId(null);
      return;
    }

    try {
      const response = await fetchTopics(access, tokenStore, activeGroupId);
      setTopics(response);
      if (response.length > 0) {
        setActiveTopicId((current) => current ?? response[0].id);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load topics",
      );
    }
  }, [
    activeGroupId,
    groups,
    tokenRef,
    tokenStore,
    setTopics,
    setActiveTopicId,
    setError,
  ]);

  const handleAuthSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError("");

      try {
        if (authMode === "register") {
          await register(username, email, password);
        }
        const loginResponse = await login(username, password);
        tokenRef.current = loginResponse;
        setTokens(loginResponse);
        setStatus("Authenticated");
      } catch (authError) {
        setError(
          authError instanceof Error
            ? authError.message
            : "Authentication failed",
        );
      }
    },
    [
      authMode,
      username,
      email,
      password,
      tokenRef,
      setTokens,
      setStatus,
      setError,
    ],
  );

  const handleLogout = useCallback(() => {
    setTokens(null);
    setStatus("Logged out");
    setError("");
    setMe(null);
    setUsers([]);
    setNotifications([]);
    setDirectChats([]);
    setGroups([]);
    setTopics([]);
    setMessages([]);
    setDecryptedText({});
    setMyProfile(null);
    identityRef.current = null;
    sharedKeyCache.current.clear();
    groupKeyCache.current.clear();
    disconnectSocket();
  }, [
    setTokens,
    setStatus,
    setError,
    setMe,
    setUsers,
    setNotifications,
    setDirectChats,
    setGroups,
    setTopics,
    setMessages,
    setDecryptedText,
    setMyProfile,
    disconnectSocket,
  ]);

  const handleCreateDirectChat = useCallback(async () => {
    const access = tokenRef.current?.access;
    if (!selectedUserId || !access) return;
    try {
      const chat = await createDirectChat(access, tokenStore, selectedUserId);
      setDirectChats((current) => {
        if (current.some((item) => item.id === chat.id)) {
          return current;
        }
        return [chat, ...current];
      });
      setRoomType("direct");
      setActiveDirectId(chat.id);
      setStatus(`Direct chat #${chat.id} opened`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Cannot create direct chat",
      );
    }
  }, [
    selectedUserId,
    tokenRef,
    tokenStore,
    setDirectChats,
    setRoomType,
    setActiveDirectId,
    setStatus,
    setError,
  ]);

  const handleCreateGroup = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const access = tokenRef.current?.access;
      if (!createGroupName.trim() || !access) return;

      try {
        const formData = new FormData();
        formData.append("name", createGroupName.trim());
        if (createGroupDescription.trim()) {
          formData.append("description", createGroupDescription.trim());
        }
        if (createGroupIsSupergroup) {
          formData.append("is_supergroup", "true");
        }
        if (createGroupAvatar) {
          formData.append("avatar", createGroupAvatar);
        }

        const created = await createGroup(access, tokenStore, formData);

        setGroups((current) => [created, ...current]);
        setCreateGroupName("");
        setCreateGroupDescription("");
        setCreateGroupIsSupergroup(false);
        setCreateGroupAvatar(null);
        setStatus(
          `${created.is_supergroup ? "Supergroup" : "Group"} ${created.name} created`,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot create group",
        );
      }
    },
    [
      createGroupName,
      createGroupDescription,
      createGroupIsSupergroup,
      createGroupAvatar,
      tokenRef,
      tokenStore,
      setGroups,
      setCreateGroupName,
      setCreateGroupDescription,
      setCreateGroupIsSupergroup,
      setCreateGroupAvatar,
      setStatus,
      setError,
    ],
  );

  const handleCreateTopic = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const access = tokenRef.current?.access;
      if (!activeGroupId || !newTopicTitle.trim() || !access) return;

      try {
        const created = await createTopicApi(
          access,
          tokenStore,
          activeGroupId,
          newTopicTitle.trim(),
        );
        setTopics((current) => [created, ...current]);
        setActiveTopicId(created.id);
        setNewTopicTitle("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot create topic",
        );
      }
    },
    [
      activeGroupId,
      newTopicTitle,
      tokenRef,
      tokenStore,
      setTopics,
      setActiveTopicId,
      setNewTopicTitle,
      setError,
    ],
  );

  const loadGroupDetails = useCallback(
    async (groupId: number) => {
      const access = tokenRef.current?.access;
      if (!access) return;
      try {
        const details = await getGroupDetails(access, tokenStore, groupId);
        upsertGroupDetails(groupId, details);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot load group details",
        );
      }
    },
    [tokenRef, tokenStore, upsertGroupDetails, setError],
  );

  const loadGroupMembers = useCallback(
    async (groupId: number) => {
      const access = tokenRef.current?.access;
      if (!access) return;
      try {
        const members = await listGroupMembers(access, tokenStore, groupId);
        setGroupMembers(groupId, members);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot load members",
        );
      }
    },
    [tokenRef, tokenStore, setGroupMembers, setError],
  );

  const handleAddMember = useCallback(
    async (groupId: number, userId: number) => {
      const access = tokenRef.current?.access;
      if (!access) return;
      try {
        const created: GroupMember = await addGroupMember(
          access,
          tokenStore,
          groupId,
          userId,
        );
        appendGroupMember(groupId, created);
        setStatus(`Added member #${userId}`);

        // Distribute group key to the new member
        const groupKey = await getOrDeriveGroupKey(groupId);
        const identity = identityRef.current;
        if (identity && groupKey) {
          try {
            let memberJwk = publicKeys[userId];
            if (!memberJwk) {
              const resp = await getUserPublicKey(access, tokenStore, userId);
              if (resp.public_key) {
                memberJwk = resp.public_key;
                setPublicKey(userId, memberJwk);
              }
            }
            if (memberJwk) {
              const memberPublic = await importPublicJwk(memberJwk);
              const wrapKey = await deriveSharedKey(identity.privateKey, memberPublic);
              const encrypted = await encryptGroupKey(groupKey, wrapKey);
              await setGroupEncryptedKey(access, tokenStore, groupId, userId, encrypted.ciphertext, encrypted.iv);
            }
          } catch {
            // Non-fatal: member can still request the key later
          }
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot add member",
        );
      }
    },
    [tokenRef, tokenStore, appendGroupMember, setStatus, setError, publicKeys, setPublicKey, getOrDeriveGroupKey],
  );

  const loadUserProfile = useCallback(
    async (userId: number) => {
      const access = tokenRef.current?.access;
      if (!access) return;
      try {
        const profile = await getUserProfile(access, tokenStore, userId);
        upsertUserProfile(userId, profile);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot load user profile",
        );
      }
    },
    [tokenRef, tokenStore, upsertUserProfile, setError],
  );

  const handleUpdateProfile = useCallback(
    async (values: {
      avatar?: File | null;
      description?: string;
      status?: string;
      clearAvatar?: boolean;
    }): Promise<UserProfile | null> => {
      const access = tokenRef.current?.access;
      if (!access) return null;

      try {
        const form = new FormData();
        if (values.avatar) {
          form.append("avatar", values.avatar);
        } else if (values.clearAvatar) {
          form.append("avatar", "");
        }
        if (values.description !== undefined) {
          form.append("description", values.description);
        }
        if (values.status !== undefined) {
          form.append("status", values.status);
        }

        const updated = await updateMyProfile(access, tokenStore, form);
        setMyProfile(updated);
        setStatus("Profile updated");
        return updated;
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot update profile",
        );
        return null;
      }
    },
    [tokenRef, tokenStore, setMyProfile, setStatus, setError],
  );

  const handleSendMessage = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const access = tokenRef.current?.access;
      const plainText = messageInput.trim();
      const hasAttachmentIntent = Object.keys(pendingAttachments).some((id) =>
        id.startsWith("draft:"),
      );
      if (!plainText && !hasAttachmentIntent) {
        setError("Message is required");
        return;
      }
      if (!access) {
        setError("Not authenticated");
        return;
      }

      const canSendDirect = roomType === "direct" && activeDirectId;
      const canSendGroup = roomType === "group" && activeGroupId;
      if (!canSendDirect && !canSendGroup) {
        setError("Choose a room before sending");
        return;
      }

      try {
        const activeGroup =
          groups.find((group) => group.id === activeGroupId) ?? null;
        if (roomType === "group" && activeGroup?.is_supergroup && !activeTopicId) {
          setError("Select a topic for supergroup message");
          return;
        }

        let ciphertext = plainText;
        let iv = `plain:${Date.now()}`;
        let encrypted = false;

        if (roomType === "direct" && activeDirectId) {
          const peerId = resolvePeerId();
          if (peerId) {
            const sharedKey = await getOrDerivePeerKey(peerId);
            if (sharedKey && plainText) {
              const payload = await encryptWithKey(sharedKey, plainText);
              ciphertext = payload.ciphertext;
              iv = payload.iv;
              encrypted = true;
            }
          }
        } else if (roomType === "group" && activeGroupId) {
          const groupKey = await getOrDeriveGroupKey(activeGroupId);
          if (groupKey && plainText) {
            const payload = await encryptWithKey(groupKey, plainText);
            ciphertext = payload.ciphertext;
            iv = payload.iv;
            encrypted = true;
          }
        }

        const socketPayload: Record<string, unknown> = { ciphertext, iv };
        if (roomType === "group" && activeGroup?.is_supergroup) {
          socketPayload.topic_id = activeTopicId;
        }

        const localId = crypto.randomUUID();
        const optimistic: ChatMessage = {
          localId,
          chat_id: activeDirectId ?? undefined,
          group_id: activeGroupId ?? undefined,
          topic_id: activeTopicId,
          sender_user_id: me?.id,
          ciphertext,
          iv,
          created_at: new Date().toISOString(),
          pending: true,
        };
        applyIncomingMessage(optimistic);
        if (plainText) {
          setDecryptedText((current) => ({
            ...current,
            [getMessageKey(optimistic)]: plainText,
          }));
        }

        // Transfer any draft attachment to this message's localId
        const draftFile = pendingAttachments["draft:current"];
        if (draftFile) {
          setPendingAttachment("draft:current", null);
          setPendingAttachment(localId, draftFile);
        }

        const socket = wsRef.current;
        let serverMessage: ChatMessage | null = null;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(socketPayload));
        } else {
          const endpoint =
            roomType === "direct"
              ? `/api/chats/${activeDirectId}/messages/`
              : `/api/chats/groups/${activeGroupId}/messages/`;
          serverMessage = await sendMessageRest(
            access,
            tokenStore,
            endpoint,
            socketPayload,
          );
          applyIncomingMessage({ ...serverMessage, localId });
        }

        setMessageInput("");
        setError("");

        // Upload attachment once we have a server-side id
        if (draftFile && serverMessage?.id) {
          try {
            const attachment: Attachment = await uploadAttachment(
              access,
              tokenStore,
              serverMessage.id,
              draftFile,
            );
            setPendingAttachment(localId, null);
            setMessages((current) =>
              current.map((item) =>
                item.id === serverMessage!.id
                  ? {
                      ...item,
                      attachments: [...(item.attachments ?? []), attachment],
                    }
                  : item,
              ),
            );
          } catch (uploadError) {
            setError(
              uploadError instanceof Error
                ? `Upload failed: ${uploadError.message}`
                : "Attachment upload failed",
            );
          }
        }

        if (!encrypted) {
          setStatus("Sent (no key — plaintext)");
        }
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Failed to send message",
        );
      }
    },
    [
      messageInput,
      pendingAttachments,
      tokenRef,
      roomType,
      activeDirectId,
      activeGroupId,
      activeTopicId,
      groups,
      me,
      applyIncomingMessage,
      setDecryptedText,
      wsRef,
      tokenStore,
      setMessageInput,
      setError,
      setStatus,
      resolvePeerId,
      getOrDerivePeerKey,
      setPendingAttachment,
      setMessages,
    ],
  );

  const markNotificationAsRead = useCallback(
    async (notificationId: number) => {
      const access = tokenRef.current?.access;
      if (!access) return;

      try {
        await markNotificationRead(access, tokenStore, notificationId);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, is_read: true } : item,
          ),
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Cannot mark notification as read",
        );
      }
    },
    [tokenRef, tokenStore, setNotifications, setError],
  );

  const tryDecryptDirectMessage = useCallback(
    async (message: ChatMessage): Promise<string | null> => {
      if (!me || message.iv.startsWith("plain:")) return null;
      if (message.chat_id == null) return null;

      const peerId =
        message.sender_user_id && message.sender_user_id !== me.id
          ? message.sender_user_id
          : message.receiver_user_id ?? resolvePeerId();
      if (!peerId) return null;

      const sharedKey = await getOrDerivePeerKey(peerId);
      if (!sharedKey) return null;
      try {
        return await decryptWithKey(sharedKey, message.ciphertext, message.iv);
      } catch {
        return null;
      }
    },
    [me, resolvePeerId, getOrDerivePeerKey],
  );

  const tryDecryptGroupMessage = useCallback(
    async (message: ChatMessage): Promise<string | null> => {
      if (message.iv.startsWith("plain:")) return null;
      if (message.group_id == null) return null;

      const groupKey = await getOrDeriveGroupKey(message.group_id);
      if (!groupKey) return null;
      try {
        return await decryptWithKey(groupKey, message.ciphertext, message.iv);
      } catch {
        return null;
      }
    },
    [getOrDeriveGroupKey],
  );

  return {
    bootstrap,
    loadMessages,
    loadTopics,
    handleAuthSubmit,
    handleLogout,
    handleCreateDirectChat,
    handleCreateGroup,
    handleCreateTopic,
    handleSendMessage,
    markNotificationAsRead,
    loadGroupDetails,
    loadGroupMembers,
    handleAddMember,
    loadUserProfile,
    handleUpdateProfile,
    tryDecryptDirectMessage,
    tryDecryptGroupMessage,
    setupIdentityFromMnemonic,
  };
}
