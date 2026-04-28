import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "../store/chatStore";
import { useChatActions } from "./useChatActions";
import { useChatSocket } from "./useChatSocket";
import { usePresenceSocket } from "./usePresenceSocket";
import { useNotificationSocket } from "./useNotificationSocket";
import { useMessageDisplay } from "./useMessageDisplay";
import { useTokenStore } from "./useTokenStore";
import { useToast } from "../components/ToastProvider";
import type { ChatMessage, Notification } from "../types/chat";

export function useChatPageController() {
  const { tokens, tokenRef, tokenStore } = useTokenStore();

  const {
    groups,
    topics,
    messages,
    roomType,
    activeDirectId,
    activeGroupId,
    activeTopicId,
    mnemonicRequired,
    setMessages,
    setStatus,
    setError,
    setUserOnline,
    setTypingUser,
    prependNotification,
  } = useChatStore(
    useShallow((state) => ({
      groups: state.groups,
      topics: state.topics,
      messages: state.messages,
      roomType: state.roomType,
      activeDirectId: state.activeDirectId,
      activeGroupId: state.activeGroupId,
      activeTopicId: state.activeTopicId,
      mnemonicRequired: state.mnemonicRequired,
      setMessages: state.setMessages,
      setStatus: state.setStatus,
      setError: state.setError,
      setUserOnline: state.setUserOnline,
      setTypingUser: state.setTypingUser,
      prependNotification: state.prependNotification,
    })),
  );

  const setRightPanel = useChatStore((state) => state.setRightPanel);

  const messageDecryptorRef = useRef<
    ((msg: ChatMessage) => Promise<string | null>) | null
  >(null);

  const {
    setDecryptedText,
    getMessageText,
  } = useMessageDisplay(messages, messageDecryptorRef);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const activeRoomTitle = useMemo(() => {
    if (roomType === "direct") {
      return activeDirectId
        ? `Direct #${activeDirectId}`
        : "No direct chat selected";
    }
    if (!activeGroup) {
      return "No group selected";
    }
    if (activeGroup.is_supergroup && activeTopicId) {
      const activeTopic = topics.find((topic) => topic.id === activeTopicId);
      return `${activeGroup.name} / ${activeTopic?.title ?? `Topic ${activeTopicId}`}`;
    }
    return activeGroup.name;
  }, [roomType, activeDirectId, activeGroup, activeTopicId, topics]);

  const applyIncomingMessage = useCallback(
    (incoming: ChatMessage) => {
      setMessages((current) => {
        const hasSameId =
          typeof incoming.id === "number" &&
          current.some(
            (item) => typeof item.id === "number" && item.id === incoming.id,
          );

        if (hasSameId) {
          return current;
        }

        const replacePendingIndex = current.findIndex(
          (item) =>
            item.pending &&
            item.ciphertext === incoming.ciphertext &&
            item.iv === incoming.iv &&
            item.sender_user_id === incoming.sender_user_id,
        );

        if (replacePendingIndex >= 0) {
          const copy = [...current];
          copy[replacePendingIndex] = { ...incoming, pending: false };
          return copy;
        }

        return [...current, incoming];
      });
    },
    [setMessages],
  );

  const { wsRef, disconnectSocket } = useChatSocket({
    tokens,
    roomType,
    activeDirectId,
    activeGroupId,
    activeTopicId,
    activeRoomTitle,
    tokenStore,
    applyIncomingMessage,
    setTypingUser,
    setStatus,
    setError,
  });

  const { sendTyping } = usePresenceSocket({
    tokens,
    tokenStore,
    setUserOnline,
    setTypingUser,
  });

  const { showToast } = useToast();

  const handleIncomingNotification = useCallback(
    (n: Notification) => {
      // id === 0 is a sentinel for group notifications without a DB id
      if (n.id > 0) {
        prependNotification(n);
      }
      showToast(n.message ?? "New notification", { kind: "message" });
    },
    [prependNotification, showToast],
  );

  useNotificationSocket({
    tokens,
    tokenStore,
    onNotification: handleIncomingNotification,
  });

  const presenceRoomKey = useMemo(() => {
    if (roomType === "direct" && activeDirectId != null)
      return `direct:${activeDirectId}`;
    if (roomType === "group") {
      if (activeTopicId != null) return `topic:${activeTopicId}`;
      if (activeGroupId != null) return `group:${activeGroupId}`;
    }
    return null;
  }, [roomType, activeDirectId, activeGroupId, activeTopicId]);

  const actions = useChatActions({
    tokenRef,
    tokenStore,
    wsRef,
    disconnectSocket,
    applyIncomingMessage,
    setDecryptedText,
  });

  const {
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
  } = actions;

  useEffect(() => {
    messageDecryptorRef.current = async (msg: ChatMessage) => {
      if (msg.chat_id != null) return tryDecryptDirectMessage(msg);
      if (msg.group_id != null) return tryDecryptGroupMessage(msg);
      return null;
    };
  }, [tryDecryptDirectMessage, tryDecryptGroupMessage]);

  const showGroupInfo = useCallback(() => {
    if (!activeGroupId) return;
    setRightPanel({ kind: "groupInfo", targetId: activeGroupId });
  }, [activeGroupId, setRightPanel]);

  const showProfile = useCallback(
    (userId: number) => {
      setRightPanel({ kind: "profile", targetId: userId });
    },
    [setRightPanel],
  );

  const closeRightPanel = useCallback(() => {
    setRightPanel({ kind: null, targetId: null });
  }, [setRightPanel]);

  useEffect(() => {
    if (!tokens) {
      disconnectSocket();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void bootstrap();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [tokens, bootstrap, disconnectSocket]);

  useEffect(() => {
    if (roomType !== "group") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void loadTopics();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roomType, activeGroupId, loadTopics]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMessages();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadMessages]);

  return {
    tokens,
    mnemonicRequired,
    activeRoomTitle,
    roomType,
    activeGroup,
    getMessageText,
    bootstrap,
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
    showGroupInfo,
    showProfile,
    closeRightPanel,
    sendTyping,
    presenceRoomKey,
    setupIdentityFromMnemonic,
  };
}
