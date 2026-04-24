import { useMemo } from "react";
import { API_BASE } from "../lib/chatApi";
import { useSidebarSlice } from "../store/chatSelectors";
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

export function ChatSidebar({
  handleCreateDirectChat,
  handleCreateGroup,
  handleCreateTopic,
  markNotificationAsRead,
}: ChatSidebarProps) {
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
  } = useSidebarSlice();

  const activeGroup = useMemo<Group | null>(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-tg-bg">
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
      </div>

      <div className="flex-1 overflow-y-auto">
        {roomType === "direct" ? (
          <>
            <div className="border-b border-tg-border px-3 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
                New direct chat
              </p>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm"
                  value={selectedUserId ?? ""}
                  onChange={(event) =>
                    setSelectedUserId(Number(event.target.value) || null)
                  }
                >
                  <option value="">Choose user</option>
                  {users
                    .filter((user) => user.id !== me?.id)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username}
                      </option>
                    ))}
                </select>
                <button
                  className="rounded-lg bg-tg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-50"
                  onClick={handleCreateDirectChat}
                  disabled={!selectedUserId}
                  type="button"
                >
                  Start
                </button>
              </div>
            </div>

            <div className="py-1">
              {directChats.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-tg-text-muted">
                  No direct chats yet
                </p>
              )}
              {directChats.map((chat) => {
                const isActive = activeDirectId === chat.id;
                const label = `Chat ${chat.id}`;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      setRoomType("direct");
                      setActiveDirectId(chat.id);
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      isActive
                        ? "bg-tg-panel-active"
                        : "hover:bg-tg-panel-hover"
                    }`}
                  >
                    <Avatar label={label} seed={chat.id} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        Chat #{chat.id}
                      </p>
                      <p className="truncate text-xs text-tg-text-secondary">
                        Direct conversation
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <form
              className="border-b border-tg-border px-3 py-3"
              onSubmit={handleCreateGroup}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
                Create group
              </p>
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
                  placeholder="Group name"
                  value={createGroupName}
                  onChange={(event) => setCreateGroupName(event.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
                  placeholder="Description"
                  value={createGroupDescription}
                  onChange={(event) =>
                    setCreateGroupDescription(event.target.value)
                  }
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
                    onChange={(event) =>
                      setCreateGroupAvatar(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <button
                  className="w-full rounded-lg bg-tg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover"
                  type="submit"
                >
                  Create {createGroupIsSupergroup ? "supergroup" : "group"}
                </button>
              </div>
            </form>

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
                <form className="px-3 py-3" onSubmit={handleCreateTopic}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
                    Add topic
                  </p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted"
                      placeholder="Topic title"
                      value={newTopicTitle}
                      onChange={(event) => setNewTopicTitle(event.target.value)}
                    />
                    <button
                      className="rounded-lg bg-tg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-tg-accent-hover"
                      type="submit"
                    >
                      Add
                    </button>
                  </div>
                </form>

                <div className="pb-2">
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
                    Topics
                  </p>
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

        {notifications.length > 0 && (
          <div className="border-t border-tg-border px-3 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tg-text-muted">
              Notifications
            </p>
            <div className="space-y-1.5">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-tg-panel p-2.5 text-xs"
                >
                  <p className="text-tg-text">
                    {item.message ?? `Notification #${item.id}`}
                  </p>
                  {item.created_at && (
                    <p className="mt-1 text-[11px] text-tg-text-muted">
                      {item.created_at}
                    </p>
                  )}
                  <button
                    className={`mt-2 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      item.is_read
                        ? "bg-tg-bg text-tg-text-muted"
                        : "bg-tg-accent text-white hover:bg-tg-accent-hover"
                    }`}
                    type="button"
                    onClick={() => markNotificationAsRead(item.id)}
                    disabled={item.is_read}
                  >
                    {item.is_read ? "Read" : "Mark as read"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
