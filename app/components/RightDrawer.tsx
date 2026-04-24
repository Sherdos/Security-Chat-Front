"use client";

type RightDrawerProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function RightDrawer({ title, onClose, children }: RightDrawerProps) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-tg-border bg-tg-bg">
      <header className="flex items-center justify-between border-b border-tg-border px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          className="rounded-full p-2 text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-text"
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-current"
            aria-hidden="true"
          >
            <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
          </svg>
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
