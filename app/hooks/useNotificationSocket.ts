import { useEffect } from "react";
import { WS_BASE, refreshTokens, type Tokens } from "../lib/chatApi";
import type { Notification } from "../types/chat";
import type { TokenStore } from "./useTokenStore";

type NotificationFrame = {
  type: "notification";
  id: number;
  message: string;
  notification_type?: string;
  is_read?: boolean;
  created_at?: string;
};

type UseNotificationSocketParams = {
  tokens: Tokens | null;
  tokenStore: TokenStore;
  onNotification: (n: Notification) => void;
};

export function useNotificationSocket({
  tokens,
  tokenStore,
  onNotification,
}: UseNotificationSocketParams) {
  useEffect(() => {
    if (!tokens?.access) return;

    const socket = new WebSocket(
      `${WS_BASE}/ws/notifications/?token=${tokens.access}`,
    );

    socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string) as NotificationFrame;
        if (frame.type !== "notification") return;
        onNotification({
          id: frame.id,
          message: frame.message,
          is_read: frame.is_read ?? false,
          created_at: frame.created_at,
        });
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = async (event) => {
      if (event.code === 4401) {
        await refreshTokens(tokenStore);
      }
    };

    return () => {
      socket.close();
    };
  }, [tokens, tokenStore, onNotification]);
}
