"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export type ToastKind = "message" | "info" | "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
};

type ToastCtx = {
  showToast: (title: string, options?: { body?: string; kind?: ToastKind }) => void;
};

const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _seq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<number, number>>({});

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, { body, kind = "info" }: { body?: string; kind?: ToastKind } = {}) => {
      const id = _seq++;
      setToasts((prev) => [...prev.slice(-4), { id, kind, title, body }]);
      timersRef.current[id] = window.setTimeout(() => dismiss(id), 4_500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        suppressHydrationWarning
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[200] flex flex-col items-end gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLES: Record<ToastKind, { bar: string; icon: React.ReactNode }> = {
  message: {
    bar: "bg-tg-accent",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
      </svg>
    ),
  },
  info: {
    bar: "bg-tg-accent",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
  },
  success: {
    bar: "bg-green-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    ),
  },
  error: {
    bar: "bg-tg-danger",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { bar, icon } = KIND_STYLES[toast.kind];

  return (
    <div
      role="alert"
      className="animate-toast-enter pointer-events-auto flex w-80 overflow-hidden rounded-xl border border-tg-border bg-tg-panel shadow-2xl"
    >
      <div className={`w-1 shrink-0 ${bar}`} />
      <div className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3">
        <span className={`mt-0.5 shrink-0 ${bar.replace("bg-", "text-")}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-tg-text">
            {toast.title}
          </p>
          {toast.body && (
            <p className="mt-0.5 truncate text-xs text-tg-text-secondary">
              {toast.body}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-full p-1 text-tg-text-muted transition hover:bg-tg-panel-hover hover:text-tg-text"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
