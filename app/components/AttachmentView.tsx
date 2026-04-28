"use client";

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

type AttachmentViewProps = {
  attachments: Attachment[];
};

export function AttachmentView({ attachments }: AttachmentViewProps) {
  if (attachments.length === 0) return null;
  console.log(attachments);

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
          return (
            <audio key={attachment.id} controls className="w-full" src={url} />
          );
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
