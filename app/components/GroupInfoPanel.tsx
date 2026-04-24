"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/chatApi";
import { useRightPanelSlice } from "../store/chatSelectors";
import type { Group, GroupMember, GroupMemberRole } from "../types/chat";
import { RightDrawer } from "./RightDrawer";

type GroupInfoPanelProps = {
  loadGroupDetails: (groupId: number) => Promise<void>;
  loadGroupMembers: (groupId: number) => Promise<void>;
  handleAddMember: (groupId: number, userId: number) => Promise<void>;
  onClose: () => void;
};

const ROLE_STYLES: Record<GroupMemberRole, string> = {
  owner: "bg-[#ffd54f]/20 text-[#ffd54f]",
  admin: "bg-tg-accent/20 text-tg-accent-hover",
  member: "bg-tg-panel-hover text-tg-text-secondary",
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

function gradientFor(seed: number) {
  return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

export function GroupInfoPanel({
  loadGroupDetails,
  loadGroupMembers,
  handleAddMember,
  onClose,
}: GroupInfoPanelProps) {
  const { rightPanel, users, groupDetails, groups, groupMembers } =
    useRightPanelSlice();
  const [addUserId, setAddUserId] = useState<number | "">("");

  const groupId = rightPanel.kind === "groupInfo" ? rightPanel.targetId : null;

  const group: Group | null = useMemo(() => {
    if (groupId == null) return null;
    return (
      groupDetails[groupId] ?? groups.find((entry) => entry.id === groupId) ?? null
    );
  }, [groupId, groupDetails, groups]);

  const members = useMemo<GroupMember[]>(
    () => (groupId != null ? (groupMembers[groupId] ?? []) : []),
    [groupId, groupMembers],
  );

  useEffect(() => {
    if (groupId == null) return;
    void loadGroupDetails(groupId);
    void loadGroupMembers(groupId);
  }, [groupId, loadGroupDetails, loadGroupMembers]);

  if (groupId == null) return null;

  const memberIds = new Set(members.map((entry) => entry.user_id));
  const candidates = users.filter((user) => !memberIds.has(user.id));
  const avatarUrl = absoluteUrl(group?.avatar);

  const onSubmitAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typeof addUserId !== "number") return;
    void handleAddMember(groupId, addUserId).then(() => {
      setAddUserId("");
    });
  };

  return (
    <RightDrawer
      title={group?.is_supergroup ? "Supergroup info" : "Group info"}
      onClose={onClose}
    >
      <div className="flex flex-col items-center gap-3 border-b border-tg-border px-5 py-6">
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt={group?.name ?? "Group"}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-3xl font-semibold text-white ${gradientFor(
              groupId,
            )}`}
          >
            {(group?.name ?? "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="text-center">
          <p className="text-lg font-semibold">{group?.name ?? "Loading..."}</p>
          <p className="text-xs text-tg-text-muted">
            {group?.is_supergroup ? "Supergroup" : "Group"}
            {typeof group?.owner_id === "number" ? ` · Owner #${group.owner_id}` : ""}
          </p>
        </div>
        {group?.description && (
          <p className="text-center text-sm text-tg-text-secondary">
            {group.description}
          </p>
        )}
      </div>

      <section className="px-5 py-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
          Members ({members.length})
        </p>
        {members.length === 0 && (
          <p className="text-sm text-tg-text-muted">No members loaded</p>
        )}
        <ul className="space-y-1">
          {members.map((member) => {
            const user =
              member.user ?? users.find((u) => u.id === member.user_id);
            const label = user?.username ?? `User #${member.user_id}`;
            return (
              <li
                key={member.user_id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-tg-panel-hover"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ${gradientFor(
                    member.user_id,
                  )}`}
                >
                  {label.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  {user?.email && (
                    <p className="truncate text-xs text-tg-text-muted">
                      {user.email}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ROLE_STYLES[member.role]}`}
                >
                  {member.role}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {candidates.length > 0 && (
        <form
          className="border-t border-tg-border px-5 py-4"
          onSubmit={onSubmitAdd}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
            Add member
          </p>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm"
              value={addUserId}
              onChange={(event) =>
                setAddUserId(
                  event.target.value ? Number(event.target.value) : "",
                )
              }
            >
              <option value="">Choose user</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addUserId === ""}
              className="rounded-lg bg-tg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </form>
      )}
    </RightDrawer>
  );
}
