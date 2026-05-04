import { useCallback, useEffect, useRef } from "react";
import { WS_BASE, refreshTokens, type Tokens } from "../lib/chatApi";
import type { ChatMessage, RoomType } from "../types/chat";
import type { TokenStore } from "./useTokenStore";

type UseChatSocketParams = {
  tokens: Tokens | null;
  roomType: RoomType;
  activeDirectId: number | null;
  activeGroupId: number | null;
  activeTopicId: number | null;
  activeRoomTitle: string;
  tokenStore: TokenStore;
  applyIncomingMessage: (incoming: ChatMessage) => void;
  setTypingUser: (roomKey: string, userId: number, typing: boolean) => void;
  setMessageIsRead: (messageId: number) => void;
  setStatus: (value: string) => void;
  setError: (value: string) => void;
};

export function useChatSocket({
  tokens,
  roomType,
  activeDirectId,
  activeGroupId,
  activeTopicId,
  activeRoomTitle,
  tokenStore,
  applyIncomingMessage,
  setTypingUser,
  setMessageIsRead,
  setStatus,
  setError,
}: UseChatSocketParams) {
  const wsRef = useRef<WebSocket | null>(null);
  // Timeouts that auto-clear a typing indicator 3 s after the last event.
  const typingTimeoutsRef = useRef<Record<string, Record<number, number>>>({});

  const disconnectSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!tokens?.access) {
      disconnectSocket();
      return;
    }

    const wsPath =
      roomType === "direct"
        ? activeDirectId
          ? `/ws/chats/${activeDirectId}/?token=${tokens.access}`
          : null
        : activeGroupId
          ? activeTopicId
            ? `/ws/groups/${activeGroupId}/topics/${activeTopicId}/?token=${tokens.access}`
            : `/ws/groups/${activeGroupId}/?token=${tokens.access}`
          : null;

    if (!wsPath) {
      disconnectSocket();
      return;
    }

    disconnectSocket();
    const socket = new WebSocket(`${WS_BASE}${wsPath}`);
    wsRef.current = socket;

    socket.onopen = () => setStatus(`Connected to ${activeRoomTitle}`);

    socket.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string) as Record<string, unknown>;

        if (raw.type === "read_receipt") {
          const messageId = raw.message_id as number | undefined;
          if (typeof messageId === "number") setMessageIsRead(messageId);
          return;
        }

        if (raw.type === "typing") {
          const userId = raw.user_id as number;
          const roomKey =
            raw.chat_id != null
              ? `direct:${raw.chat_id}`
              : raw.topic_id != null
                ? `topic:${raw.topic_id}`
                : `group:${raw.group_id}`;

          // Reset the auto-clear timeout for this user in this room.
          const existing = typingTimeoutsRef.current[roomKey]?.[userId];
          if (existing !== undefined) window.clearTimeout(existing);

          setTypingUser(roomKey, userId, true);

          if (!typingTimeoutsRef.current[roomKey]) {
            typingTimeoutsRef.current[roomKey] = {};
          }
          typingTimeoutsRef.current[roomKey][userId] = window.setTimeout(() => {
            setTypingUser(roomKey, userId, false);
            delete typingTimeoutsRef.current[roomKey]?.[userId];
          }, 3_000);
          return;
        }

        applyIncomingMessage(raw as ChatMessage);
      } catch {
        setError("Received invalid realtime payload");
      }
    };

    socket.onclose = async (event) => {
      if (event.code === 4401) {
        const refreshed = await refreshTokens(tokenStore);
        if (!refreshed) {
          setError("Session expired. Please login again.");
        }
      } else if (event.code === 4403) {
        setError("Forbidden room access (4403).");
      }
    };

    socket.onerror = () => {
      setStatus("WebSocket error; using REST fallback");
    };

    return () => {
      // Clear all pending typing timeouts when the room changes.
      Object.values(typingTimeoutsRef.current).forEach((byUser) =>
        Object.values(byUser).forEach((tid) => window.clearTimeout(tid)),
      );
      typingTimeoutsRef.current = {};
      socket.close();
    };
  }, [
    tokens,
    roomType,
    activeDirectId,
    activeGroupId,
    activeTopicId,
    activeRoomTitle,
    disconnectSocket,
    applyIncomingMessage,
    setTypingUser,
    setMessageIsRead,
    tokenStore,
    setStatus,
    setError,
  ]);

  const sendRead = useCallback((messageId: number) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "read", message_id: messageId }));
    }
  }, []);

  return {
    wsRef,
    disconnectSocket,
    sendRead,
  };
}
