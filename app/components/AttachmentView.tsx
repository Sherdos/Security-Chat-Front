"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/chatApi";
import type { Attachment } from "../types/chat";

function absoluteUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDuration(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// Deterministic bar heights so each voice message has a stable waveform.
function makeBars(seed: string, count: number): number[] {
  const bars: number[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    bars.push(0.15 + ((h & 0xff) / 255) * 0.85);
  }
  return bars;
}

const BAR_COUNT = 40;

function AudioPlayer({ url, isMine }: { url: string; isMine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useRef(makeBars(url, BAR_COUNT)).current;

  useEffect(() => {
    const el = new Audio(url);
    audioRef.current = el;
    el.onloadedmetadata = () => setDuration(el.duration);
    el.ontimeupdate = () => setCurrent(el.currentTime);
    el.onended = () => { setPlaying(false); setCurrent(0); };
    return () => {
      el.pause();
      el.src = "";
    };
  }, [url]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  }, [duration]);

  const progress = duration > 0 ? current / duration : 0;
  const activeColor = isMine ? "bg-white/90" : "bg-tg-accent";
  const inactiveColor = isMine ? "bg-white/30" : "bg-tg-accent/25";

  return (
    <div className="flex w-64 items-center gap-3">
      {/* Play / pause button */}
      <button
        type="button"
        onClick={toggle}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          isMine
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-tg-accent/15 hover:bg-tg-accent/25 text-tg-accent"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zm6 9a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2zm-6 8a1 1 0 0 1-1-1v-1h2v1a1 1 0 0 1-1 1z" />
          </svg>
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Waveform bars */}
        <div
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Seek"
          tabIndex={0}
          className="flex h-8 cursor-pointer items-end gap-px"
          onClick={seek}
          onKeyDown={(e) => {
            if (!audioRef.current || !duration) return;
            if (e.key === "ArrowRight") audioRef.current.currentTime = Math.min(duration, current + 2);
            if (e.key === "ArrowLeft") audioRef.current.currentTime = Math.max(0, current - 2);
          }}
        >
          {bars.map((h, i) => {
            const barProgress = i / BAR_COUNT;
            const active = barProgress <= progress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${active ? activeColor : inactiveColor}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
        </div>

        {/* Time */}
        <span className={`text-[10px] tabular-nums ${isMine ? "text-white/60" : "text-tg-text-muted"}`}>
          {fmtDuration(playing || current > 0 ? current : duration)}
        </span>
      </div>
    </div>
  );
}

type AttachmentViewProps = {
  attachments: Attachment[];
  isMine?: boolean;
};

export function AttachmentView({ attachments, isMine }: AttachmentViewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((attachment) => {
        const url = absoluteUrl(attachment.file_url);
        if (!url) return null;
        if (attachment.attachment_type === "image") {
          return (
            <a
              key={attachment.id}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={attachment.file ?? "image"}
                className="max-h-80 w-full rounded-xl object-cover"
              />
            </a>
          );
        }
        if (attachment.attachment_type === "video") {
          return (
            <video
              key={attachment.id}
              controls
              className="max-h-80 rounded-xl bg-black"
              src={url}
            />
          );
        }
        if (attachment.attachment_type === "audio") {
          return <AudioPlayer key={attachment.id} url={url} isMine={isMine} />;
        }
        return (
          <a
            key={attachment.id}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl bg-tg-bg-main/40 px-3 py-2 text-xs hover:bg-tg-bg-main/60"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 shrink-0 fill-current text-tg-accent"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {attachment.file ?? "Attachment"}
              </p>
              <p className="text-[11px] text-tg-text-muted">{formatSize(1)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
