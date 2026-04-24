export type User = {
  id: number;
  username: string;
  email?: string;
};

export type UserProfile = {
  avatar?: string | null;
  description?: string;
  status?: string;
};

export type Notification = {
  id: number;
  message?: string;
  is_read?: boolean;
  created_at?: string;
};

export type Chat = {
  id: number;
  participants?: User[];
};

export type Group = {
  id: number;
  name: string;
  is_supergroup?: boolean;
  description?: string;
  avatar?: string | null;
  owner_id?: number;
};

export type GroupMemberRole = "owner" | "admin" | "member";

export type GroupMember = {
  user_id: number;
  role: GroupMemberRole;
  user?: User;
};

export type Topic = {
  id: number;
  title: string;
};

export type AttachmentKind = "image" | "video" | "audio" | "file";

export type Attachment = {
  id: number;
  message_id?: number;
  kind: AttachmentKind;
  url: string;
  filename?: string;
  size?: number;
};

export type ChatMessage = {
  id?: number;
  localId?: string;
  chat_id?: number;
  group_id?: number;
  topic_id?: number | null;
  sender_user_id?: number;
  receiver_user_id?: number;
  ciphertext: string;
  iv: string;
  created_at?: string;
  pending?: boolean;
  attachments?: Attachment[];
};

export type RoomType = "direct" | "group";

export type RightPanelKind = "profile" | "groupInfo";

export type RightPanelState = {
  kind: RightPanelKind | null;
  targetId: number | null;
};
