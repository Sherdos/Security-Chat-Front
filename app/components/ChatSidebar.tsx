import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { API_BASE, searchUsers } from "../lib/chatApi";
import { useTokenStore } from "../hooks/useTokenStore";
import { useSidebarSlice } from "../store/chatSelectors";
import type { User } from "../types/chat";
import type { Group } from "../types/chat";

type ChatSidebarProps = {
  handleCreateDirectChat: () => void;
  handleCreateGroup: (event: React.FormEvent<HTMLFormElement>) => void;
  handleCreateTopic: (event: React.FormEvent<HTMLFormElement>) => void;
  markNotificationAsRead: (notificationId: number) => void;
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

function gradientFor(seed: number | string) {
  const key = typeof seed === "number" ? seed : seed.charCodeAt(0) || 0;
  return AVATAR_GRADIENTS[Math.abs(key) % AVATAR_GRADIENTS.length];
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

type AvatarProps = {
  label: string;
  seed: number | string;
  imageUrl?: string | null;
  size?: "sm" | "md";
};

function Avatar({ label, seed, imageUrl, size = "md" }: AvatarProps) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const url = absoluteUrl(imageUrl);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={label}
        className={`shrink-0 rounded-full object-cover ${dim}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${gradientFor(
        seed,
      )} ${dim}`}
    >
      {initials(label)}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-tg-bg shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-tg-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-tg-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-tg-text-secondary hover:bg-tg-panel-hover hover:text-tg-text"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
              aria-hidden="true"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

type UserSearchInputProps = {
  excludeIds?: Set<number>;
  selectedUser: User | null;
  onSelect: (user: User | null) => void;
};

function UserSearchInput({ excludeIds, selectedUser, onSelect }: UserSearchInputProps) {
  const { tokenRef, tokenStore } = useTokenStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      const access = tokenRef.current?.access;
      if (!access || !q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      searchUsers(access, tokenStore, q)
        .then((users) => {
          setResults(excludeIds ? users.filter((u) => !excludeIds.has(u.id)) : users);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    },
    [tokenRef, tokenStore, excludeIds],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  };

  const handleSelect = (user: User) => {
    onSelect(user);
    setQuery(user.username);
    setResults([]);
  };

  if (selectedUser && query === selectedUser.username) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-tg-accent bg-tg-panel px-3 py-2 text-sm text-left"
        onClick={() => {
          onSelect(null);
          setQuery("");
        }}
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ${gradientFor(selectedUser.id)}`}>
          {initials(selectedUser.username)}
        </div>
        <span className="flex-1 truncate font-medium">{selectedUser.username}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current text-tg-text-muted" aria-hidden="true">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted focus:border-tg-accent focus:outline-none"
        placeholder="Search users…"
        value={query}
        onChange={handleChange}
        autoFocus
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tg-text-muted">…</span>
      )}
      {results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-tg-border bg-tg-bg shadow-xl">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-tg-panel-hover"
                onClick={() => handleSelect(user)}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ${gradientFor(user.id)}`}>
                  {initials(user.username)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.username}</p>
                  {user.email && <p className="truncate text-xs text-tg-text-muted">{user.email}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && query.trim().length > 0 && results.length === 0 && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-tg-border bg-tg-bg px-3 py-2 text-xs text-tg-text-muted shadow-xl">
          No users found
        </p>
      )}
    </div>
  );
}

export function ChatSidebar({
  handleCreateDirectChat,
  handleCreateGroup,
  handleCreateTopic,
  markNotificationAsRead,
}: ChatSidebarProps) {
  const [openModal, setOpenModal] = useState<
    "direct" | "group" | "topic" | null
  >(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [directUser, setDirectUser] = useState<User | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const {
    roomType,
    setRoomType,
    selectedUserId,
    setSelectedUserId,
    users,
    me,
    directChats,
    activeDirectId,
    setActiveDirectId,
    userProfiles,
    createGroupName,
    setCreateGroupName,
    createGroupDescription,
    setCreateGroupDescription,
    createGroupIsSupergroup,
    setCreateGroupIsSupergroup,
    createGroupAvatar,
    setCreateGroupAvatar,
    groups,
    activeGroupId,
    setActiveGroupId,
    setActiveTopicId,
    newTopicTitle,
    setNewTopicTitle,
    topics,
    activeTopicId,
    notifications,
    onlineUsers,
  } = useSidebarSlice();

  const activeGroup = useMemo<Group | null>(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-tg-bg">
      {/* Tab row + compose button */}
      <div className="flex items-center gap-1 border-b border-tg-border bg-tg-bg p-2">
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            roomType === "direct"
              ? "bg-tg-accent text-white"
              : "text-tg-text-secondary hover:bg-tg-panel-hover hover:text-tg-text"
          }`}
          onClick={() => setRoomType("direct")}
        >
          Direct
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            roomType === "group"
              ? "bg-tg-accent text-white"
              : "text-tg-text-secondary hover:bg-tg-panel-hover hover:text-tg-text"
          }`}
          onClick={() => setRoomType("group")}
        >
          Groups
        </button>

        {/* Compose button */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-accent"
            title="New"
            aria-label="New"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-current"
              aria-hidden="true"
            >
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-tg-border bg-tg-bg shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-tg-text hover:bg-tg-panel-hover"
                onClick={() => {
                  setOpenModal("direct");
                  setMenuOpen(false);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 fill-current text-tg-accent"
                  aria-hidden="true"
                >
                  <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
                </svg>
                New Message
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-tg-text hover:bg-tg-panel-hover"
                onClick={() => {
                  setCreateGroupIsSupergroup(false);
                  setOpenModal("group");
                  setMenuOpen(false);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 fill-current text-tg-accent"
                  aria-hidden="true"
                >
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                New Group
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-tg-text hover:bg-tg-panel-hover"
                onClick={() => {
                  setCreateGroupIsSupergroup(true);
                  setOpenModal("group");
                  setMenuOpen(false);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 fill-current text-tg-accent"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                New Supergroup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Message modal */}
      {openModal === "direct" && (
        <Modal
          title="New Message"
          onClose={() => {
            setOpenModal(null);
            setDirectUser(null);
          }}
        >
          <div className="space-y-3">
            <UserSearchInput
              excludeIds={me ? new Set([me.id]) : undefined}
              selectedUser={directUser}
              onSelect={(user) => {
                setDirectUser(user);
                setSelectedUserId(user?.id ?? null);
              }}
            />
            <button
              type="button"
              className="w-full rounded-lg bg-tg-accent py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-50"
              onClick={() => {
                handleCreateDirectChat();
                setOpenModal(null);
                setDirectUser(null);
              }}
              disabled={!selectedUserId}
            >
              Start
            </button>
          </div>
        </Modal>
      )}

      {/* New Group / New Supergroup modal */}
      {openModal === "group" && (
        <Modal
          title={createGroupIsSupergroup ? "New Supergroup" : "New Group"}
          onClose={() => setOpenModal(null)}
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              handleCreateGroup(e);
              setOpenModal(null);
            }}
          >
            <input
              className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
              placeholder="Group name"
              value={createGroupName}
              onChange={(e) => setCreateGroupName(e.target.value)}
              autoFocus
            />
            <input
              className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
              placeholder="Description (optional)"
              value={createGroupDescription}
              onChange={(e) => setCreateGroupDescription(e.target.value)}
            />
            <div className="flex rounded-lg bg-tg-panel p-1">
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  !createGroupIsSupergroup
                    ? "bg-tg-accent text-white"
                    : "text-tg-text-secondary hover:text-tg-text"
                }`}
                onClick={() => setCreateGroupIsSupergroup(false)}
              >
                Group
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  createGroupIsSupergroup
                    ? "bg-tg-accent text-white"
                    : "text-tg-text-secondary hover:text-tg-text"
                }`}
                onClick={() => setCreateGroupIsSupergroup(true)}
              >
                Supergroup
              </button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-tg-border bg-tg-panel/50 px-3 py-2 text-xs text-tg-text-secondary hover:border-tg-accent hover:text-tg-text">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
                aria-hidden="true"
              >
                <path d="M19 7v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5zM8.5 14.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" />
              </svg>
              <span className="truncate">
                {createGroupAvatar
                  ? createGroupAvatar.name
                  : "Avatar (optional)"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  setCreateGroupAvatar(e.target.files?.[0] ?? null)
                }
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-tg-accent py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-50"
              disabled={!createGroupName.trim()}
            >
              Create {createGroupIsSupergroup ? "supergroup" : "group"}
            </button>
          </form>
        </Modal>
      )}

      {/* Add Topic modal */}
      {openModal === "topic" && (
        <Modal title="Add Topic" onClose={() => setOpenModal(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              handleCreateTopic(e);
              setOpenModal(null);
            }}
          >
            <input
              className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
              placeholder="Topic title"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-tg-accent py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-50"
              disabled={!newTopicTitle.trim()}
            >
              Add Topic
            </button>
          </form>
        </Modal>
      )}

      {/* Sidebar list */}
      <div className="flex-1 overflow-y-auto">
        {roomType === "direct" ? (
          <div className="py-1">
            {directChats.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-tg-text-muted">
                No direct chats yet
              </p>
            )}
            {directChats.map((chat) => {
              const isActive = activeDirectId === chat.id;
              const peerId =
                chat.sender_user_id === me?.id
                  ? chat.receiver_user_id
                  : chat.sender_user_id;
              const peerProfile = peerId ? userProfiles[peerId] : null;
              const peerUser = peerId
                ? users.find((u) => u.id === peerId)
                : null;
              const peerName =
                peerProfile?.username ??
                peerUser?.username ??
                `Chat #${chat.id}`;
              const peerAvatar = absoluteUrl(
                peerProfile?.avatar ?? peerProfile?.avatar_url,
              );
              const peerStatus = peerProfile?.status;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => {
                    setRoomType("direct");
                    setActiveDirectId(chat.id);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    isActive ? "bg-tg-panel-active" : "hover:bg-tg-panel-hover"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      label={peerName}
                      seed={peerId ?? chat.id}
                      imageUrl={peerAvatar}
                    />
                    {peerId != null && onlineUsers[peerId] && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-tg-bg bg-green-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{peerName}</p>
                    <p className="truncate text-xs text-tg-text-secondary">
                      {peerId != null && onlineUsers[peerId]
                        ? "online"
                        : (peerStatus ?? "Direct message")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="py-1">
              {groups.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-tg-text-muted">
                  No groups yet
                </p>
              )}
              {groups.map((group) => {
                const isActive = activeGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setRoomType("group");
                      setActiveGroupId(group.id);
                      if (!group.is_supergroup) {
                        setActiveTopicId(null);
                      }
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      isActive
                        ? "bg-tg-panel-active"
                        : "hover:bg-tg-panel-hover"
                    }`}
                  >
                    <Avatar
                      label={group.name}
                      seed={group.id + 100}
                      imageUrl={group.avatar}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {group.name}
                      </p>
                      <p className="truncate text-xs text-tg-text-secondary">
                        {group.is_supergroup ? "Supergroup" : "Group"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeGroup?.is_supergroup && (
              <div className="border-t border-tg-border">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
                    Topics
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenModal("topic")}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-tg-text-muted transition hover:bg-tg-panel-hover hover:text-tg-accent"
                    title="Add topic"
                    aria-label="Add topic"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 fill-current"
                      aria-hidden="true"
                    >
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                  </button>
                </div>
                <div className="pb-2">
                  {topics.length === 0 && (
                    <p className="px-4 py-3 text-center text-xs text-tg-text-muted">
                      No topics yet
                    </p>
                  )}
                  {topics.map((topic) => {
                    const isActive = activeTopicId === topic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setActiveTopicId(topic.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-tg-panel-active text-white"
                            : "text-tg-text-secondary hover:bg-tg-panel-hover hover:text-tg-text"
                        }`}
                      >
                        <span className="text-tg-accent">#</span>
                        <span className="truncate">{topic.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
