import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "./chatStore";

export function useAuthSlice() {
  return useChatStore(
    useShallow((state) => ({
      authMode: state.authMode,
      username: state.username,
      email: state.email,
      password: state.password,
      error: state.error,
      setAuthMode: state.setAuthMode,
      setUsername: state.setUsername,
      setEmail: state.setEmail,
      setPassword: state.setPassword,
    })),
  );
}

export function useHeaderSlice() {
  return useChatStore(
    useShallow((state) => ({
      me: state.me,
      myProfile: state.myProfile,
      status: state.status,
      error: state.error,
    })),
  );
}

export function useSidebarSlice() {
  return useChatStore(
    useShallow((state) => ({
      roomType: state.roomType,
      setRoomType: state.setRoomType,
      selectedUserId: state.selectedUserId,
      setSelectedUserId: state.setSelectedUserId,
      users: state.users,
      me: state.me,
      myProfile: state.myProfile,
      directChats: state.directChats,
      activeDirectId: state.activeDirectId,
      setActiveDirectId: state.setActiveDirectId,
      createGroupName: state.createGroupName,
      setCreateGroupName: state.setCreateGroupName,
      createGroupDescription: state.createGroupDescription,
      setCreateGroupDescription: state.setCreateGroupDescription,
      createGroupIsSupergroup: state.createGroupIsSupergroup,
      setCreateGroupIsSupergroup: state.setCreateGroupIsSupergroup,
      createGroupAvatar: state.createGroupAvatar,
      setCreateGroupAvatar: state.setCreateGroupAvatar,
      groups: state.groups,
      activeGroupId: state.activeGroupId,
      setActiveGroupId: state.setActiveGroupId,
      setActiveTopicId: state.setActiveTopicId,
      newTopicTitle: state.newTopicTitle,
      setNewTopicTitle: state.setNewTopicTitle,
      topics: state.topics,
      activeTopicId: state.activeTopicId,
      notifications: state.notifications,
      setRightPanel: state.setRightPanel,
      userProfiles: state.userProfiles,
      onlineUsers: state.onlineUsers,
    })),
  );
}

export function useMessagePanelSlice() {
  return useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      me: state.me,
      messageInput: state.messageInput,
      setMessageInput: state.setMessageInput,
      userProfiles: state.userProfiles,
      setRightPanel: state.setRightPanel,
      pendingAttachments: state.pendingAttachments,
      setPendingAttachment: state.setPendingAttachment,
      typingUsers: state.typingUsers,
    })),
  );
}

export function useRightPanelSlice() {
  return useChatStore(
    useShallow((state) => ({
      rightPanel: state.rightPanel,
      setRightPanel: state.setRightPanel,
      me: state.me,
      myProfile: state.myProfile,
      userProfiles: state.userProfiles,
      users: state.users,
      groupDetails: state.groupDetails,
      groups: state.groups,
      groupMembers: state.groupMembers,
    })),
  );
}
