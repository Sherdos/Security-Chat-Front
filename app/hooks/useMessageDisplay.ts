import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import { decryptMessage } from "../lib/crypto";
import { getMessageKey, isPlainMessage } from "../lib/chatMessage";
import type { ChatMessage } from "../types/chat";

type DirectDecryptor =
  | ((message: ChatMessage) => Promise<string | null>)
  | null;

export function useMessageDisplay(
  messages: ChatMessage[],
  directDecryptorRef?: MutableRefObject<DirectDecryptor>,
) {
  const [decryptedText, setDecryptedText] = useState<Record<string, string>>(
    {},
  );
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    const directDecryptor = directDecryptorRef?.current ?? null;

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

        if (directDecryptor && message.chat_id != null) {
          const ecdhResult = await directDecryptor(message);
          if (ecdhResult !== null) {
            return [key, ecdhResult] as const;
          }
        }

        if (!passphrase) {
          return [key, null] as const;
        }

        try {
          const plain = await decryptMessage(
            message.ciphertext,
            message.iv,
            passphrase,
          );
          return [key, plain] as const;
        } catch {
          return [key, "Unable to decrypt with current passphrase"] as const;
        }
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
  }, [messages, passphrase, decryptedText, directDecryptorRef]);

  function handlePassphraseInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const nextValue = event.target.value;
    setPassphrase(nextValue);
    if (!nextValue) {
      setDecryptedText((current) => {
        // keep ECDH-decrypted entries; drop passphrase-derived ones we can't distinguish → simplest: clear all
        // Keeping behaviour simple matches previous implementation.
        void current;
        return {};
      });
    }
  }

  function getMessageText(message: ChatMessage): string {
    if (isPlainMessage(message)) {
      return message.ciphertext;
    }
    return decryptedText[getMessageKey(message)] ?? message.ciphertext;
  }

  return {
    passphrase,
    decryptedText,
    setDecryptedText,
    handlePassphraseInputChange,
    getMessageText,
  };
}
