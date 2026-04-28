"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, searchUsers } from "../lib/chatApi";
import { useTokenStore } from "../hooks/useTokenStore";
import { useRightPanelSlice } from "../store/chatSelectors";
import type { Group, GroupMember, GroupMemberRole, User } from "../types/chat";
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
  const { tokenRef, tokenStore } = useTokenStore();
  const [addUser, setAddUser] = useState<User | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<User[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const avatarUrl = absoluteUrl(group?.avatar);

  const runAddSearch = useCallback(
    (q: string) => {
      const access = tokenRef.current?.access;
      if (!access || !q.trim()) { setAddResults([]); return; }
      setAddLoading(true);
      searchUsers(access, tokenStore, q)
        .then((list) => setAddResults(list.filter((u) => !memberIds.has(u.id))))
        .catch(() => setAddResults([]))
        .finally(() => setAddLoading(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tokenRef, tokenStore, memberIds],
  );

  const handleAddQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setAddQuery(q);
    setAddUser(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setAddResults([]); return; }
    debounceRef.current = setTimeout(() => runAddSearch(q), 300);
  };

  const onSubmitAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addUser) return;
    void handleAddMember(groupId, addUser.id).then(() => {
      setAddUser(null);
      setAddQuery("");
      setAddResults([]);
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

      <form
        className="border-t border-tg-border px-5 py-4"
        onSubmit={onSubmitAdd}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
          Add member
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            {addUser ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-tg-accent bg-tg-panel px-3 py-2 text-sm"
                onClick={() => { setAddUser(null); setAddQuery(""); }}
              >
                <span className="flex-1 truncate text-left font-medium">{addUser.username}</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-current text-tg-text-muted" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            ) : (
              <input
                className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted focus:border-tg-accent focus:outline-none"
                placeholder="Search users…"
                value={addQuery}
                onChange={handleAddQueryChange}
              />
            )}
            {addLoading && !addUser && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tg-text-muted">…</span>
            )}
            {addResults.length > 0 && !addUser && (
              <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-lg border border-tg-border bg-tg-bg shadow-xl">
                {addResults.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-tg-panel-hover"
                      onClick={() => { setAddUser(user); setAddQuery(user.username); setAddResults([]); }}
                    >
                      <span className="font-medium">{user.username}</span>
                      {user.email && <span className="truncate text-xs text-tg-text-muted">{user.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!addLoading && !addUser && addQuery.trim().length > 0 && addResults.length === 0 && (
              <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-tg-border bg-tg-bg px-3 py-2 text-xs text-tg-text-muted shadow-xl">
                No users found
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!addUser}
            className="rounded-lg bg-tg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </form>
    </RightDrawer>
  );
}
