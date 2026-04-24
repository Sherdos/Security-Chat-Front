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
  setStatus,
  setError,
}: UseChatSocketParams) {
  const wsRef = useRef<WebSocket | null>(null);

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
        const incoming = JSON.parse(event.data) as ChatMessage;
        applyIncomingMessage(incoming);
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
    tokenStore,
    setStatus,
    setError,
  ]);

  return {
    wsRef,
    disconnectSocket,
  };
}
