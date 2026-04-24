import type { ChatMessage } from "../types/chat";

export function getMessageKey(message: ChatMessage): string {
  if (typeof message.id === "number") {
    return `id-${message.id}`;
  }
  if (message.localId) {
    return `local-${message.localId}`;
  }
  return `fallback-${message.ciphertext.slice(0, 12)}-${message.iv.slice(0, 12)}-${message.created_at ?? ""}`;
}

export function isPlainMessage(message: ChatMessage): boolean {
  return message.iv.startsWith("plain:");
}
