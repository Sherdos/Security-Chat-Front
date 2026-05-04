"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/chatApi";
import { getMessageKey } from "../lib/chatMessage";
import { useMessagePanelSlice } from "../store/chatSelectors";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import type { ChatMessage } from "../types/chat";
import { AttachmentView } from "./AttachmentView";

type MessagePanelProps = {
  getMessageText: (message: ChatMessage) => string;
  handleSendMessage: (event: React.FormEvent<HTMLFormElement>) => void;
  showProfile: (userId: number) => void;
  loadUserProfile: (userId: number) => Promise<void>;
  sendTyping: (roomKey: string) => void;
  presenceRoomKey: string | null;
  markMessageSeen: (messageId: number) => void;
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

function dayKey(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDaySeparator(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - msgDay.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: diffDays > 365 ? "numeric" : undefined });
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

function MessageStatusIcon({ message }: { message: ChatMessage }) {
  if (message.pending) {
    // Clock — sending
    return (
      <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current opacity-50" aria-label="Sending" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.5 3.5v4l2.8 1.6-.8 1.3-3.5-2V4.5h1.5z" />
      </svg>
    );
  }
  if (message.is_read) {
    // Double checkmark — read (accent teal)
    return (
      <svg viewBox="0 0 18 11" className="h-3 w-4.5 fill-current text-tg-accent" aria-label="Read" aria-hidden="true">
        <path d="M1 5.5 5.5 10l7-9" strokeWidth="0" />
        <path d="M0 5.5 5 10 12 1M5 10l7-9" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10l7-9" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(5,0)" />
      </svg>
    );
  }
  // Single checkmark — sent
  return (
    <svg viewBox="0 0 12 11" className="h-3 w-3 fill-current opacity-70" aria-label="Sent" aria-hidden="true">
      <path d="M0 5.5 5 10 12 1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MessagePanel({
  getMessageText,
  handleSendMessage,
  showProfile,
  loadUserProfile,
  sendTyping,
  presenceRoomKey,
  markMessageSeen,
}: MessagePanelProps) {
  const {
    messages,
    me,
    messageInput,
    setMessageInput,
    userProfiles,
    pendingAttachments,
    setPendingAttachment,
    typingUsers,
  } = useMessagePanelSlice();

  const typingUserIds = presenceRoomKey
    ? (typingUsers[presenceRoomKey] ?? []).filter((id) => id !== me?.id)
    : [];

  const typingLabel = (() => {
    if (typingUserIds.length === 0) return null;
    const names = typingUserIds.map(
      (id) => userProfiles[id]?.username ?? `User ${id}`,
    );
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return `${names.length} people are typing`;
  })();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftFile = pendingAttachments["draft:current"] ?? null;

  // Observe incoming messages and fire markMessageSeen when they scroll into view.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = Number((entry.target as HTMLElement).dataset.messageId);
          if (!id) return;
          observerRef.current?.unobserve(entry.target);
          markMessageSeen(id);
        });
      },
      { threshold: 0.5 },
    );
    return () => {
      observerRef.current?.disconnect();
      observedRef.current.clear();
    };
  }, [markMessageSeen]);

  // Revocable object URL for audio draft preview
  const [audioDraftUrl, setAudioDraftUrl] = useState<string | null>(null);
  useEffect(() => {
    if (draftFile && draftFile.type.startsWith("audio/")) {
      const url = URL.createObjectURL(draftFile);
      setAudioDraftUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setAudioDraftUrl(null);
      };
    }
    setAudioDraftUrl(null);
  }, [draftFile]);

  const onRecorded = useCallback(
    (file: File) => {
      setPendingAttachment("draft:current", file);
    },
    [setPendingAttachment],
  );

  const { isRecording, seconds, micError, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder({ onRecorded });

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

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
              const showDateSep = dayKey(message.created_at) !== dayKey(prev?.created_at);
              const sameSenderAsPrev =
                !showDateSep && prev && prev.sender_user_id === message.sender_user_id;

              const peerProfile =
                !isMine && typeof message.sender_user_id === "number"
                  ? userProfiles[message.sender_user_id]
                  : null;
              const peerAvatar = absoluteUrl(peerProfile?.avatar);

              // Attach IntersectionObserver for received messages with a server id.
              const incomingId = !isMine && typeof message.id === "number" ? message.id : null;
              const attachObserver = (el: HTMLElement | null) => {
                if (!el || !incomingId || observedRef.current.has(incomingId) || message.is_read) return;
                observedRef.current.add(incomingId);
                observerRef.current?.observe(el);
              };

              return (
                <article key={key}>
                  {showDateSep && (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-tg-border/50" />
                      <span className="rounded-full bg-tg-panel px-3 py-0.5 text-[11px] text-tg-text-muted shadow-sm">
                        {formatDaySeparator(message.created_at)}
                      </span>
                      <div className="h-px flex-1 bg-tg-border/50" />
                    </div>
                  )}
                  <div
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
                          {(
                            peerProfile?.username ??
                            String(message.sender_user_id ?? "?")
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                    </button>
                  )}
                  {!isMine && sameSenderAsPrev && (
                    <div className="w-8 shrink-0" />
                  )}

                  <div
                    ref={attachObserver}
                    data-message-id={incomingId ?? undefined}
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
                        {peerProfile?.username ??
                          `User ${message.sender_user_id ?? "?"}`}
                      </p>
                    )}
                    {textToRender.trim() && (
                      <p className="whitespace-pre-wrap break-words leading-snug">
                        {textToRender}
                      </p>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <AttachmentView attachments={message.attachments} isMine={isMine} />
                    )}
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/60">
                      <span>{formatTime(message.created_at)}</span>
                      {isMine && <MessageStatusIcon message={message} />}
                    </div>
                  </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {typingLabel && (
        <div className="flex items-center gap-2 border-t border-tg-border/50 bg-tg-bg px-5 py-1.5">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-tg-text-secondary [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-tg-text-secondary [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-tg-text-secondary [animation-delay:300ms]" />
          </span>
          <p className="text-xs text-tg-text-secondary">{typingLabel}</p>
        </div>
      )}

      <form
        className="border-t border-tg-border bg-tg-bg px-4 py-3"
        onSubmit={handleSendMessage}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {draftFile && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-tg-panel px-3 py-2 text-xs">
              {audioDraftUrl ? (
                <div className="flex items-center gap-2">
                  <AttachmentView
                    attachments={[{ id: 0, attachment_type: "audio", file_url: audioDraftUrl }]}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-1 text-tg-text-muted hover:bg-tg-panel-hover hover:text-tg-text"
                    onClick={() => setPendingAttachment("draft:current", null)}
                    aria-label="Remove voice message"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
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
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
          {isRecording ? (
            <div className="flex items-center gap-3 rounded-2xl border border-tg-border bg-tg-panel px-4 py-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <span className="min-w-[3.5rem] font-mono text-sm tabular-nums text-tg-text">
                {formatSeconds(seconds)}
              </span>
              <span className="flex-1 text-xs text-tg-text-secondary">Recording…</span>
              <button
                type="button"
                onClick={cancelRecording}
                className="rounded-full p-1.5 text-tg-text-muted transition hover:bg-tg-panel-hover hover:text-tg-danger"
                aria-label="Cancel recording"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-accent text-white transition hover:bg-tg-accent-hover"
                aria-label="Stop and attach recording"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-text"
                aria-label="Attach file"
                title="Attach file"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
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
                onChange={(event) => {
                  setMessageInput(event.target.value);
                  if (presenceRoomKey && event.target.value) {
                    sendTyping(presenceRoomKey);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              {messageInput.trim() || draftFile ? (
                <button
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tg-accent text-white transition hover:bg-tg-accent-hover"
                  type="submit"
                  aria-label="Send"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-text"
                  aria-label="Record voice message"
                  title="Record voice message"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zm6 9a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2zm-6 8a1 1 0 0 1-1-1v-1h2v1a1 1 0 0 1-1 1z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {micError && (
            <p className="text-xs text-tg-danger">{micError}</p>
          )}
        </div>
      </form>
    </section>
  );
}
