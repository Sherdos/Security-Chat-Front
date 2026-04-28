import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import { getMessageKey, isPlainMessage } from "../lib/chatMessage";
import type { ChatMessage } from "../types/chat";

type MessageDecryptor = (message: ChatMessage) => Promise<string | null>;

export function useMessageDisplay(
  messages: ChatMessage[],
  messageDecryptorRef?: MutableRefObject<MessageDecryptor | null>,
) {
  const [decryptedText, setDecryptedText] = useState<Record<string, string>>({});

  useEffect(() => {
    const decryptor = messageDecryptorRef?.current ?? null;
    if (!decryptor) return;

    const missing = messages.filter((message) => {
      if (isPlainMessage(message)) return false;
      const key = getMessageKey(message);
      return !decryptedText[key];
    });

    if (missing.length === 0) return;

    let cancelled = false;

    Promise.all(
      missing.map(async (message) => {
        const key = getMessageKey(message);
        const result = await decryptor(message);
        return [key, result] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setDecryptedText((current) => {
        const next = { ...current };
        pairs.forEach(([key, value]) => {
          if (value !== null) {
            next[key] = value;
          }
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [messages, decryptedText, messageDecryptorRef]);

  function getMessageText(message: ChatMessage): string {
    if (isPlainMessage(message)) return message.ciphertext;
    return decryptedText[getMessageKey(message)] ?? "🔒";
  }

  return {
    decryptedText,
    setDecryptedText,
    getMessageText,
  };
}
