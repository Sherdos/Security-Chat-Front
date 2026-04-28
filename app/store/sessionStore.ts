import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Tokens } from "../lib/chatApi";

type SessionStore = {
  tokens: Tokens | null;
  setTokens: (tokens: Tokens | null) => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      tokens: null,
      setTokens: (tokens) => set({ tokens }),
    }),
    {
      name: "onlinechatfront.tokens",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
