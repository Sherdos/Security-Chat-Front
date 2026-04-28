"use client";

import { API_BASE } from "./lib/chatApi";
import { AuthView } from "./components/AuthView";
import { ChatSidebar } from "./components/ChatSidebar";
import { GroupInfoPanel } from "./components/GroupInfoPanel";
import { MessagePanel } from "./components/MessagePanel";
import { MnemonicSetupModal } from "./components/MnemonicSetupModal";
import { ProfilePanel } from "./components/ProfilePanel";
import { useChatPageController } from "./hooks/useChatPageController";
import {
  useHeaderSlice,
  useRightPanelSlice,
} from "./store/chatSelectors";

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

export default function Home() {
  const { me, myProfile, status, error } = useHeaderSlice();
  const { rightPanel } = useRightPanelSlice();

  const {
    tokens,
    mnemonicRequired,
    roomType,
    activeGroup,
    activeRoomTitle,
    getMessageText,
    bootstrap,
    handleAuthSubmit,
    handleLogout,
    handleCreateDirectChat,
    handleCreateGroup,
    handleCreateTopic,
    handleSendMessage,
    markNotificationAsRead,
    loadGroupDetails,
    loadGroupMembers,
    handleAddMember,
    loadUserProfile,
    handleUpdateProfile,
    showGroupInfo,
    showProfile,
    closeRightPanel,
    sendTyping,
    presenceRoomKey,
    setupIdentityFromMnemonic,
  } = useChatPageController();

  if (!tokens) {
    return <AuthView apiBase={API_BASE} handleAuthSubmit={handleAuthSubmit} />;
  }

  const meAvatarUrl = absoluteUrl(myProfile?.avatar);
  const canShowGroupInfo = roomType === "group" && Boolean(activeGroup);

  const encryptionLabel = "E2E";
  const encryptionClass = "bg-[#81c784]/20 text-[#81c784]";

  return (
    <main className="flex h-screen w-full overflow-hidden bg-tg-bg-main">
      <div className="flex w-[340px] shrink-0 flex-col border-r border-tg-border bg-tg-bg">
        <header className="flex items-center justify-between gap-2 border-b border-tg-border px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 rounded-lg p-1 text-left transition hover:bg-tg-panel-hover"
            onClick={() => me && showProfile(me.id)}
          >
            {meAvatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={meAvatarUrl}
                alt={me?.username ?? "Me"}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-tg-accent to-[#5eead4] text-xs font-semibold text-white">
                {(me?.username ?? "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                {me?.username ?? "Loading..."}
              </h1>
              <p className="truncate text-xs text-tg-text-secondary">
                {myProfile?.status || "Tap to edit profile"}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button
              className="rounded-full p-2 text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-text"
              onClick={bootstrap}
              type="button"
              aria-label="Refresh"
              title="Refresh"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-current"
                aria-hidden="true"
              >
                <path d="M17.65 6.35A8 8 0 0 0 6.34 17.66l1.42-1.42A6 6 0 1 1 18 12h-3l4 4 4-4h-3a8 8 0 0 0-2.35-5.65z" />
              </svg>
            </button>
            <button
              className="rounded-full p-2 text-tg-text-secondary transition hover:bg-tg-danger/20 hover:text-tg-danger"
              onClick={handleLogout}
              type="button"
              aria-label="Logout"
              title="Logout"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-current"
                aria-hidden="true"
              >
                <path d="M16 17l5-5-5-5v3H9v4h7v3zM14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3h-2v3H5V4h9v3h2V4a2 2 0 0 0-2-2z" />
              </svg>
            </button>
          </div>
        </header>

        <ChatSidebar
          handleCreateDirectChat={handleCreateDirectChat}
          handleCreateGroup={handleCreateGroup}
          handleCreateTopic={handleCreateTopic}
          markNotificationAsRead={markNotificationAsRead}
        />
      </div>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-tg-border bg-tg-bg px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                {activeRoomTitle || "Select a chat"}
              </h2>
              {(status || error) && (
                <p
                  className={`truncate text-xs ${
                    error ? "text-tg-danger" : "text-tg-text-secondary"
                  }`}
                >
                  {error ?? status}
                </p>
              )}
            </div>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${encryptionClass}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3 fill-current"
                aria-hidden="true"
              >
                <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
              </svg>
              {encryptionLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canShowGroupInfo && (
              <button
                type="button"
                onClick={showGroupInfo}
                className="rounded-full p-2 text-tg-text-secondary transition hover:bg-tg-panel-hover hover:text-tg-text"
                aria-label="Group info"
                title="Group info"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 fill-current"
                  aria-hidden="true"
                >
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <MessagePanel
          getMessageText={getMessageText}
          handleSendMessage={handleSendMessage}
          showProfile={showProfile}
          loadUserProfile={loadUserProfile}
          sendTyping={sendTyping}
          presenceRoomKey={presenceRoomKey}
        />
      </section>

      {mnemonicRequired && (
        <MnemonicSetupModal onSetup={setupIdentityFromMnemonic} />
      )}

      {rightPanel.kind === "groupInfo" && (
        <GroupInfoPanel
          loadGroupDetails={loadGroupDetails}
          loadGroupMembers={loadGroupMembers}
          handleAddMember={handleAddMember}
          onClose={closeRightPanel}
        />
      )}
      {rightPanel.kind === "profile" && (
        <ProfilePanel
          loadUserProfile={loadUserProfile}
          handleUpdateProfile={handleUpdateProfile}
          onClose={closeRightPanel}
        />
      )}
    </main>
  );
}
