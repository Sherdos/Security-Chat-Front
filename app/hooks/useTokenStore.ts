import { useEffect, useMemo, useRef } from "react";
import type { Tokens } from "../lib/chatApi";
import { useSessionStore } from "../store/sessionStore";


export type TokenStore = {
  get: () => Tokens | null;
  set: (tokens: Tokens | null) => void;
};

export function useTokenStore() {
  const tokens = useSessionStore((state) => state.tokens);
  const setTokens = useSessionStore((state) => state.setTokens);

  const tokenRef = useRef<Tokens | null>(tokens);

  const tokenStore = useMemo<TokenStore>(
    () => ({
      get: () => tokenRef.current,
      set: (nextTokens: Tokens | null) => {
        tokenRef.current = nextTokens;
        setTokens(nextTokens);
      },
    }),
    [setTokens],
  );

  useEffect(() => {
    useSessionStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    tokenRef.current = tokens;
  }, [tokens]);

  return {
    tokens,
    setTokens,
    tokenRef,
    tokenStore,
  };
}
