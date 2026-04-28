export type User = {
  id: number;
  username: string;
  email?: string;
};

export type UserProfile = {
  avatar?: string | null;
  /** Returned by nested user objects in chat/message responses */
  avatar_url?: string | null;
  description?: string;
  status?: string;
  /** Populated from nested API responses */
  username?: string;
  created_at?: string;
};

export type Notification = {
  id: number;
  message?: string;
  is_read?: boolean;
  created_at?: string;
};

export type Chat = {
  id: number;
  sender_user_id?: number;
  receiver_user_id?: number;
  created_at?: string;
  sender_user?: UserProfile;
  receiver_user?: UserProfile;
  /** Legacy field, no longer returned by backend */
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
  attachment_type: AttachmentKind;
  file_url?: string;
  file?: string;
};

export type ChatMessage = {
  id?: number;
  localId?: string;
  chat_id?: number;
  group_id?: number;
  topic_id?: number | null;
  sender_user_id?: number;
  receiver_user_id?: number;
  sender_user?: UserProfile;
  receiver_user?: UserProfile;
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

export type PresenceEvent =
  | { type: "presence"; user_id: number; online: boolean }
  | {
      type: "typing";
      user_id: number;
      chat_id?: number;
      group_id?: number;
      topic_id?: number | null;
    };
