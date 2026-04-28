import { useCallback, useEffect, useRef } from "react";
import { WS_BASE, refreshTokens, type Tokens } from "../lib/chatApi";
import type { PresenceEvent } from "../types/chat";
import type { TokenStore } from "./useTokenStore";

type UsePresenceSocketParams = {
  tokens: Tokens | null;
  tokenStore: TokenStore;
  setUserOnline: (userId: number, online: boolean) => void;
  setTypingUser: (roomKey: string, userId: number, typing: boolean) => void;
};

export function usePresenceSocket({
  tokens,
  tokenStore,
  setUserOnline,
  setTypingUser,
}: UsePresenceSocketParams) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const typingTimeoutsRef = useRef<Record<string, Record<number, number>>>({});
  const lastTypingSentRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!tokens?.access) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const socket = new WebSocket(
      `${WS_BASE}/ws/presence/?token=${tokens.access}`,
    );
    wsRef.current = socket;

    socket.onopen = () => {
      pingIntervalRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 30_000);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as PresenceEvent;

        if (payload.type === "presence") {
          setUserOnline(payload.user_id, payload.online);
          return;
        }

        if (payload.type === "typing") {
          const roomKey =
            payload.chat_id != null
              ? `direct:${payload.chat_id}`
              : payload.topic_id != null
                ? `topic:${payload.topic_id}`
                : `group:${payload.group_id}`;

          const { user_id: userId } = payload;

          // Clear existing auto-clear timeout for this user+room
          const existingTimeout =
            typingTimeoutsRef.current[roomKey]?.[userId];
          if (existingTimeout !== undefined) {
            window.clearTimeout(existingTimeout);
          }

          setTypingUser(roomKey, userId, true);

          if (!typingTimeoutsRef.current[roomKey]) {
            typingTimeoutsRef.current[roomKey] = {};
          }
          typingTimeoutsRef.current[roomKey][userId] = window.setTimeout(() => {
            setTypingUser(roomKey, userId, false);
            delete typingTimeoutsRef.current[roomKey]?.[userId];
          }, 3_000);
        }
      } catch {
        // ignore malformed presence events
      }
    };

    socket.onclose = async (event) => {
      if (pingIntervalRef.current !== null) {
        window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (event.code === 4401) {
        await refreshTokens(tokenStore);
      }
    };

    return () => {
      if (pingIntervalRef.current !== null) {
        window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      // Clear all typing timeouts
      Object.values(typingTimeoutsRef.current).forEach((byUser) => {
        Object.values(byUser).forEach((tid) => window.clearTimeout(tid));
      });
      typingTimeoutsRef.current = {};
      socket.close();
      wsRef.current = null;
    };
  }, [tokens, tokenStore, setUserOnline, setTypingUser]);

  const sendTyping = useCallback((roomKey: string) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    // Throttle: at most one typing event per 2 s per room
    const now = Date.now();
    if (now - (lastTypingSentRef.current[roomKey] ?? 0) < 2_000) return;
    lastTypingSentRef.current[roomKey] = now;

    const [kind, rawId] = roomKey.split(":");
    const numId = Number(rawId);

    if (kind === "direct") {
      socket.send(JSON.stringify({ type: "typing", chat_id: numId }));
    } else if (kind === "group") {
      socket.send(JSON.stringify({ type: "typing", group_id: numId }));
    } else if (kind === "topic") {
      socket.send(JSON.stringify({ type: "typing", topic_id: numId }));
    }
  }, []);

  return { sendTyping };
}
