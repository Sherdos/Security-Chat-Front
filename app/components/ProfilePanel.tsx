"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/chatApi";
import { useRightPanelSlice } from "../store/chatSelectors";
import type { UserProfile } from "../types/chat";
import { RightDrawer } from "./RightDrawer";

type ProfilePanelProps = {
  loadUserProfile: (userId: number) => Promise<void>;
  handleUpdateProfile: (values: {
    avatar?: File | null;
    description?: string;
    status?: string;
    clearAvatar?: boolean;
  }) => Promise<UserProfile | null>;
  onClose: () => void;
};

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

export function ProfilePanel({
  loadUserProfile,
  handleUpdateProfile,
  onClose,
}: ProfilePanelProps) {
  const { rightPanel, me, myProfile, userProfiles, users } =
    useRightPanelSlice();

  const targetId = rightPanel.kind === "profile" ? rightPanel.targetId : null;
  const isMe = targetId !== null && me?.id === targetId;

  const profile: UserProfile | null = useMemo(() => {
    if (targetId == null) return null;
    if (isMe) return myProfile;
    return userProfiles[targetId] ?? null;
  }, [targetId, isMe, myProfile, userProfiles]);

  const targetUser = useMemo(() => {
    if (targetId == null) return null;
    if (isMe) return me;
    const found = users.find((user) => user.id === targetId);
    if (found) return found;
    // Fallback: construct a minimal user from the cached profile
    const cached = userProfiles[targetId];
    if (cached?.username) return { id: targetId, username: cached.username };
    return null;
  }, [targetId, isMe, me, users, userProfiles]);

  useEffect(() => {
    if (targetId != null && !isMe) {
      void loadUserProfile(targetId);
    }
  }, [targetId, isMe, loadUserProfile]);

  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const lastTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (targetId !== lastTargetRef.current) {
      lastTargetRef.current = targetId;
      setDescription(profile?.description ?? "");
      setStatus(profile?.status ?? "");
      setPendingAvatar(null);
    }
  }, [targetId, profile]);

  const avatarPreviewUrl = useMemo(() => {
    if (!pendingAvatar) return null;
    return URL.createObjectURL(pendingAvatar);
  }, [pendingAvatar]);

  useEffect(() => {
    if (!avatarPreviewUrl) return;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  if (targetId == null) return null;

  const remoteAvatar = absoluteUrl(profile?.avatar);
  const displayAvatar = avatarPreviewUrl ?? remoteAvatar;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isMe) return;
    setSaving(true);
    try {
      const updated = await handleUpdateProfile({
        avatar: pendingAvatar ?? undefined,
        description,
        status,
      });
      if (updated) {
        setPendingAvatar(null);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <RightDrawer
      title={isMe ? "My profile" : targetUser?.username ?? "Profile"}
      onClose={onClose}
    >
      <div className="flex flex-col items-center gap-3 border-b border-tg-border px-5 py-6">
        {displayAvatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={displayAvatar}
            alt={targetUser?.username ?? "Profile"}
            className="h-28 w-28 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-tg-accent to-[#5eead4] text-3xl font-semibold text-white">
            {(targetUser?.username ?? "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <p className="text-lg font-semibold">
          {targetUser?.username ?? `User #${targetId}`}
        </p>
        {targetUser?.email && (
          <p className="text-xs text-tg-text-muted">{targetUser.email}</p>
        )}
      </div>

      {isMe ? (
        <form className="space-y-4 px-5 py-5" onSubmit={onSubmit}>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-tg-border bg-tg-panel/50 px-3 py-3 text-sm text-tg-text-secondary hover:border-tg-accent hover:text-tg-text">
            <span className="truncate">
              {pendingAvatar ? pendingAvatar.name : "Change avatar"}
            </span>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 fill-current"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" strokeWidth="2" stroke="currentColor" fill="none" />
            </svg>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                setPendingAvatar(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
              Status
            </label>
            <input
              className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
              placeholder="Available"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
              About
            </label>
            <textarea
              className="h-28 w-full resize-none rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
              placeholder="Write a short bio"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-tg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-tg-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      ) : (
        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
              Status
            </p>
            <p className="text-sm text-tg-text">
              {profile?.status || <span className="text-tg-text-muted">—</span>}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
              About
            </p>
            <p className="whitespace-pre-wrap text-sm text-tg-text">
              {profile?.description || (
                <span className="text-tg-text-muted">—</span>
              )}
            </p>
          </div>
          {profile?.created_at && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
                Member since
              </p>
              <p className="text-sm text-tg-text">
                {new Date(profile.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </RightDrawer>
  );
}
