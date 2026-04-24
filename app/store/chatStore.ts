import { create } from "zustand";
import type { SetStateAction } from "react";
import type {
  Chat,
  ChatMessage,
  Group,
  GroupMember,
  Notification,
  RightPanelState,
  RoomType,
  Topic,
  User,
  UserProfile,
} from "../types/chat";

type ChatStore = {
  me: User | null;
  users: User[];
  notifications: Notification[];
  directChats: Chat[];
  groups: Group[];
  topics: Topic[];
  messages: ChatMessage[];
  roomType: RoomType;
  activeDirectId: number | null;
  activeGroupId: number | null;
  activeTopicId: number | null;
  selectedUserId: number | null;
  createGroupName: string;
  createGroupDescription: string;
  createGroupIsSupergroup: boolean;
  createGroupAvatar: File | null;
  newTopicTitle: string;
  messageInput: string;
  authMode: "login" | "register";
  username: string;
  email: string;
  password: string;
  status: string;
  error: string;
  myProfile: UserProfile | null;
  userProfiles: Record<number, UserProfile>;
  groupDetails: Record<number, Group>;
  groupMembers: Record<number, GroupMember[]>;
  publicKeys: Record<number, JsonWebKey>;
  pendingAttachments: Record<string, File>;
  rightPanel: RightPanelState;
  setMe: (value: User | null) => void;
  setUsers: (value: User[]) => void;
  setNotifications: (value: SetStateAction<Notification[]>) => void;
  setDirectChats: (value: SetStateAction<Chat[]>) => void;
  setGroups: (value: SetStateAction<Group[]>) => void;
  setTopics: (value: SetStateAction<Topic[]>) => void;
  setMessages: (value: SetStateAction<ChatMessage[]>) => void;
  setRoomType: (value: RoomType) => void;
  setActiveDirectId: (value: number | null) => void;
  setActiveGroupId: (value: number | null) => void;
  setActiveTopicId: (value: SetStateAction<number | null>) => void;
  setSelectedUserId: (value: number | null) => void;
  setCreateGroupName: (value: string) => void;
  setCreateGroupDescription: (value: string) => void;
  setCreateGroupIsSupergroup: (value: boolean) => void;
  setCreateGroupAvatar: (value: File | null) => void;
  setNewTopicTitle: (value: string) => void;
  setMessageInput: (value: string) => void;
  setAuthMode: (value: "login" | "register") => void;
  setUsername: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setStatus: (value: string) => void;
  setError: (value: string) => void;
  setMyProfile: (value: UserProfile | null) => void;
  upsertUserProfile: (userId: number, value: UserProfile) => void;
  upsertGroupDetails: (groupId: number, value: Group) => void;
  setGroupMembers: (groupId: number, value: GroupMember[]) => void;
  appendGroupMember: (groupId: number, value: GroupMember) => void;
  setPublicKey: (userId: number, value: JsonWebKey) => void;
  setPendingAttachment: (localId: string, value: File | null) => void;
  setRightPanel: (value: RightPanelState) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  me: null,
  users: [],
  notifications: [],
  directChats: [],
  groups: [],
  topics: [],
  messages: [],
  roomType: "direct",
  activeDirectId: null,
  activeGroupId: null,
  activeTopicId: null,
  selectedUserId: null,
  createGroupName: "",
  createGroupDescription: "",
  createGroupIsSupergroup: false,
  createGroupAvatar: null,
  newTopicTitle: "",
  messageInput: "",
  authMode: "login",
  username: "",
  email: "",
  password: "",
  status: "",
  error: "",
  myProfile: null,
  userProfiles: {},
  groupDetails: {},
  groupMembers: {},
  publicKeys: {},
  pendingAttachments: {},
  rightPanel: { kind: null, targetId: null },
  setMe: (value) => set({ me: value }),
  setUsers: (value) => set({ users: value }),
  setNotifications: (value) =>
    set((state) => ({
      notifications:
        typeof value === "function" ? value(state.notifications) : value,
    })),
  setDirectChats: (value) =>
    set((state) => ({
      directChats:
        typeof value === "function" ? value(state.directChats) : value,
    })),
  setGroups: (value) =>
    set((state) => ({
      groups: typeof value === "function" ? value(state.groups) : value,
    })),
  setTopics: (value) =>
    set((state) => ({
      topics: typeof value === "function" ? value(state.topics) : value,
    })),
  setMessages: (value) =>
    set((state) => ({
      messages: typeof value === "function" ? value(state.messages) : value,
    })),
  setRoomType: (value) => set({ roomType: value }),
  setActiveDirectId: (value) => set({ activeDirectId: value }),
  setActiveGroupId: (value) => set({ activeGroupId: value }),
  setActiveTopicId: (value) =>
    set((state) => ({
      activeTopicId:
        typeof value === "function" ? value(state.activeTopicId) : value,
    })),
  setSelectedUserId: (value) => set({ selectedUserId: value }),
  setCreateGroupName: (value) => set({ createGroupName: value }),
  setCreateGroupDescription: (value) => set({ createGroupDescription: value }),
  setCreateGroupIsSupergroup: (value) => set({ createGroupIsSupergroup: value }),
  setCreateGroupAvatar: (value) => set({ createGroupAvatar: value }),
  setNewTopicTitle: (value) => set({ newTopicTitle: value }),
  setMessageInput: (value) => set({ messageInput: value }),
  setAuthMode: (value) => set({ authMode: value }),
  setUsername: (value) => set({ username: value }),
  setEmail: (value) => set({ email: value }),
  setPassword: (value) => set({ password: value }),
  setStatus: (value) => set({ status: value }),
  setError: (value) => set({ error: value }),
  setMyProfile: (value) => set({ myProfile: value }),
  upsertUserProfile: (userId, value) =>
    set((state) => ({
      userProfiles: { ...state.userProfiles, [userId]: value },
    })),
  upsertGroupDetails: (groupId, value) =>
    set((state) => ({
      groupDetails: { ...state.groupDetails, [groupId]: value },
      groups: state.groups.map((group) =>
        group.id === groupId ? { ...group, ...value } : group,
      ),
    })),
  setGroupMembers: (groupId, value) =>
    set((state) => ({
      groupMembers: { ...state.groupMembers, [groupId]: value },
    })),
  appendGroupMember: (groupId, value) =>
    set((state) => {
      const current = state.groupMembers[groupId] ?? [];
      if (current.some((entry) => entry.user_id === value.user_id)) {
        return state;
      }
      return {
        groupMembers: {
          ...state.groupMembers,
          [groupId]: [...current, value],
        },
      };
    }),
  setPublicKey: (userId, value) =>
    set((state) => ({
      publicKeys: { ...state.publicKeys, [userId]: value },
    })),
  setPendingAttachment: (localId, value) =>
    set((state) => {
      const next = { ...state.pendingAttachments };
      if (value) {
        next[localId] = value;
      } else {
        delete next[localId];
      }
      return { pendingAttachments: next };
    }),
  setRightPanel: (value) => set({ rightPanel: value }),
}));
