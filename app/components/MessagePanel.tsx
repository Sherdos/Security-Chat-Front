"use client";

import { useEffect, useMemo, useRef } from "react";
import { API_BASE } from "../lib/chatApi";
import { getMessageKey } from "../lib/chatMessage";
import { useMessagePanelSlice } from "../store/chatSelectors";
import type { ChatMessage } from "../types/chat";
import { AttachmentView } from "./AttachmentView";

type MessagePanelProps = {
  getMessageText: (message: ChatMessage) => string;
  handleSendMessage: (event: React.FormEvent<HTMLFormElement>) => void;
  showProfile: (userId: number) => void;
  loadUserProfile: (userId: number) => Promise<void>;
};

const AVATAR_GRADIENTS = [
  "from-[#ff8a65] to-[#ff5252]",
  "from-[#4fc3f7] to-[#1976d2]",
  "from-[#81c784] to-[#388e3c]",
  "from-[#ba68c8] to-[#7b1fa2]",
  "from-[#ffd54f] to-[#f57c00]",
  "from-[#4db6ac] to-[#00695c]",
  "from-[#f06292] to-[#c2185b]",
];

function gradientFor(seed: number | undefined) {
  const key = seed ?? 0;
  return AVATAR_GRADIENTS[Math.abs(key) % AVATAR_GRADIENTS.length];
}

function formatTime(raw?: string) {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

export function MessagePanel({
  getMessageText,
  handleSendMessage,
  showProfile,
  loadUserProfile,
}: MessagePanelProps) {
  const {
    messages,
    me,
    messageInput,
    setMessageInput,
    userProfiles,
    pendingAttachments,
    setPendingAttachment,
  } = useMessagePanelSlice();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftFile = pendingAttachments["draft:current"] ?? null;

  const peerIdsToFetch = useMemo(() => {
    const ids = new Set<number>();
    messages.forEach((message) => {
      if (
        typeof message.sender_user_id === "number" &&
        message.sender_user_id !== me?.id &&
        !userProfiles[message.sender_user_id]
      ) {
        ids.add(message.sender_user_id);
      }
    });
    return ids;
  }, [messages, me, userProfiles]);

  useEffect(() => {
    peerIdsToFetch.forEach((id) => {
      void loadUserProfile(id);
    });
  }, [peerIdsToFetch, loadUserProfile]);

  const openFilePicker = () => fileInputRef.current?.click();
  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPendingAttachment("draft:current", file);
    event.target.value = "";
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="chat-pattern flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl bg-tg-panel/80 px-5 py-3 text-center text-sm text-tg-text-secondary shadow-lg">
              No messages yet — say hi.
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {messages.map((message, index) => {
              const key = getMessageKey(message);
              const isMine = message.sender_user_id === me?.id;
              const textToRender = getMessageText(message);
              const prev = messages[index - 1];
              const sameSenderAsPrev =
                prev && prev.sender_user_id === message.sender_user_id;

              const peerProfile =
                !isMine && typeof message.sender_user_id === "number"
                  ? userProfiles[message.sender_user_id]
                  : null;
              const peerAvatar = absoluteUrl(peerProfile?.avatar);

              return (
                <article
                  key={key}
                  className={`flex items-end gap-2 ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isMine && !sameSenderAsPrev && (
                    <button
                      type="button"
                      onClick={() =>
                        message.sender_user_id !== undefined &&
                        showProfile(message.sender_user_id)
                      }
                      className="mb-1 shrink-0"
                      aria-label="Open profile"
                    >
                      {peerAvatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={peerAvatar}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white ${gradientFor(
                            message.sender_user_id,
                          )}`}
                        >
                          {String(message.sender_user_id ?? "?").slice(0, 2)}
                        </div>
                      )}
                    </button>
                  )}
                  {!isMine && sameSenderAsPrev && (
                    <div className="w-8 shrink-0" />
                  )}

                  <div
                    className={`relative max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isMine
                        ? "bg-tg-own-bubble text-white"
                        : "bg-tg-received-bubble text-tg-text"
                    } ${
                      isMine
                        ? sameSenderAsPrev
                          ? "rounded-tr-md"
                          : ""
                        : sameSenderAsPrev
                          ? "rounded-tl-md"
                          : ""
                    }`}
                  >
                    {!isMine && !sameSenderAsPrev && (
                      <p className="mb-0.5 text-xs font-semibold text-tg-accent-hover">
                        {peerProfile?.status
                          ? peerProfile.status
                          : `User ${message.sender_user_id ?? "?"}`}
                      </p>
                    )}
                    {textToRender && (
                      <p className="whitespace-pre-wrap break-words leading-snug">
                        {textToRender}
                      </p>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <AttachmentView attachments={message.attachments} />
                    )}
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/60">
                      {message.pending && <span>sending</span>}
                      <span>{formatTime(message.created_at)}</span>
                      {isMine && !message.pending && (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3 w-3 fill-current"
                          aria-hidden="true"
                        >
                          <path d="M6.5 10.8 3.7 8l-1 1 3.8 3.8 8-8-1-1z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <form
        className="border-t border-tg-border bg-tg-bg px-4 py-3"
        onSubmit={handleSendMessage}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {draftFile && (
            <div className="flex items-center gap-3 rounded-xl bg-tg-panel px-3 py-2 text-xs">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-current text-tg-accent"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-tg-text">
                {draftFile.name}
              </span>
              <button
                type="button"
                className="rounded-full p-1 text-tg-text-muted hover:bg-tg-panel-hover hover:text-tg-text"
                onClick={() => setPendingAttachment("draft:current", null)}
                aria-label="Remove attachment"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                  aria-hidden="true"
                >
                  <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={openFilePicker}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-text"
              aria-label="Attach file"
              title="Attach file"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-current"
                aria-hidden="true"
              >
                <path d="M16.5 6.5 9 14a3 3 0 1 0 4.24 4.24l8.14-8.14a5 5 0 0 0-7.07-7.07L5.76 11.34a7 7 0 1 0 9.9 9.9l6.01-6a1 1 0 1 0-1.41-1.42l-6.01 6.01a5 5 0 1 1-7.07-7.07L15.73 4.44a3 3 0 1 1 4.25 4.25l-8.14 8.13a1 1 0 0 1-1.41-1.41l7.48-7.49a1 1 0 0 0-1.41-1.42z" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFileSelected}
            />
            <textarea
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-tg-border bg-tg-panel px-4 py-3 text-sm placeholder:text-tg-text-muted focus:border-tg-accent"
              placeholder="Write a message"
              rows={1}
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tg-accent text-white transition hover:bg-tg-accent-hover disabled:opacity-40"
              type="submit"
              disabled={!messageInput.trim() && !draftFile}
              aria-label="Send"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-current"
                aria-hidden="true"
              >
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
