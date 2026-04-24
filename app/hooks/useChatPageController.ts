import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "../store/chatStore";
import { useChatActions } from "./useChatActions";
import { useChatSocket } from "./useChatSocket";
import { useMessageDisplay } from "./useMessageDisplay";
import { useTokenStore } from "./useTokenStore";
import type { ChatMessage } from "../types/chat";

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
    setMessages,
    setStatus,
    setError,
  } = useChatStore(
    useShallow((state) => ({
      groups: state.groups,
      topics: state.topics,
      messages: state.messages,
      roomType: state.roomType,
      activeDirectId: state.activeDirectId,
      activeGroupId: state.activeGroupId,
      activeTopicId: state.activeTopicId,
      setMessages: state.setMessages,
      setStatus: state.setStatus,
      setError: state.setError,
    })),
  );

  const setRightPanel = useChatStore((state) => state.setRightPanel);

  const directDecryptorRef = useRef<
    ((msg: ChatMessage) => Promise<string | null>) | null
  >(null);

  const {
    passphrase,
    setDecryptedText,
    handlePassphraseInputChange,
    getMessageText,
  } = useMessageDisplay(messages, directDecryptorRef);

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
    setStatus,
    setError,
  });

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
  } = actions;

  useEffect(() => {
    directDecryptorRef.current = tryDecryptDirectMessage;
  }, [tryDecryptDirectMessage]);

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
    passphrase,
    activeRoomTitle,
    roomType,
    activeGroup,
    handlePassphraseInputChange,
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
  };
}
