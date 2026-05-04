# OnlineChat Frontend — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-05-04  
**Status:** In Progress  

---

## 1. Overview

The OnlineChat frontend is a single-page web application built with Next.js and React. It provides a Telegram-style chat interface that connects to the OnlineChat backend via REST API and WebSocket connections. All message content is end-to-end encrypted on the client before being sent to the server.

### 1.1 Goals

- Deliver a responsive, real-time chat UI that works entirely in the browser
- Implement client-side E2E encryption so the server never handles plaintext
- Support direct (1:1) chat, group chat, and supergroup topics
- Provide intuitive presence and typing indicators
- Give users full control of their encryption identity via a mnemonic phrase

### 1.2 Out of Scope (v1)

- Server-side rendering of chat content (SPA only)
- Native mobile app
- Voice/video calling
- Message editing or deletion
- Message reactions or threading
- Read receipts per message
- Offline message queue / service worker support
- Push notifications via APNs or FCM

---

## 2. Users & Roles

| Role | Description |
|------|-------------|
| **Guest** | Can view login/register screen; no access to chat |
| **Authenticated User** | Can create and participate in direct chats; manage own profile and E2E identity |
| **Group Member** | Can send and receive messages in a group |
| **Group Admin** | Can add members and create topics in a supergroup |
| **Group Owner** | All admin privileges; group creator |

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement |
|----|-------------|
| AUTH-01 | Users can register with username, email, and password from a modal form |
| AUTH-02 | Users can log in with username and password; tokens are stored in localStorage |
| AUTH-03 | Access token is automatically refreshed on 401 responses |
| AUTH-04 | All state and localStorage tokens are cleared on logout |
| AUTH-05 | On app load the token is rehydrated from localStorage and the session is restored without re-login |

### 3.2 End-to-End Encryption Identity

| ID | Requirement |
|----|-------------|
| E2E-01 | On first login the app detects that no local identity exists and shows `MnemonicSetupModal` |
| E2E-02 | Users can generate a new 12-word mnemonic phrase for their identity |
| E2E-03 | Users can restore an existing identity by entering their mnemonic phrase |
| E2E-04 | The mnemonic is used to derive a deterministic ECDH P-256 key pair via PBKDF2 |
| E2E-05 | The derived public key is uploaded to the backend; the private key never leaves the browser |
| E2E-06 | The identity is persisted to localStorage under a versioned key (`oc:identity:v2`) |
| E2E-07 | If the user clears localStorage they must restore from mnemonic to decrypt old messages |

### 3.3 Direct Chat

| ID | Requirement |
|----|-------------|
| DM-01 | The sidebar lists all direct chats the user participates in |
| DM-02 | Clicking a chat loads its message history and opens the message panel |
| DM-03 | Before sending the first message the app performs ECDH with the recipient's public key to derive a shared AES-256-GCM key |
| DM-04 | Every outgoing message is encrypted client-side; only ciphertext and IV are sent to the server |
| DM-05 | Incoming messages are decrypted client-side before display |
| DM-06 | Messages that cannot be decrypted show a fallback indicator instead of crashing |
| DM-07 | Users can send file attachments (image, video, audio, or generic file) alongside a message |
| DM-08 | A new direct chat can be started by searching for a user and selecting them |

### 3.4 Group Chat

| ID | Requirement |
|----|-------------|
| GRP-01 | The sidebar lists all groups the user belongs to |
| GRP-02 | Clicking a group loads its message history |
| GRP-03 | Groups use a shared AES-256-GCM key that is distributed to each member encrypted with their public key |
| GRP-04 | When a user opens a group the app fetches and decrypts the group key using their private key |
| GRP-05 | All group messages are encrypted and decrypted client-side using the group key |
| GRP-06 | Users can create a new group with a name, optional description, optional avatar, and an option to make it a supergroup |
| GRP-07 | Group admins/owners can add new members from the group info panel |
| GRP-08 | When adding a member the app attempts to distribute the group key encrypted for that member's public key |

### 3.5 Supergroups & Topics

| ID | Requirement |
|----|-------------|
| SG-01 | Supergroups display a list of topics in the sidebar under the group |
| SG-02 | Selecting a topic opens a message stream filtered to that topic |
| SG-03 | Admins/owners can create new topics from the sidebar |
| SG-04 | Messages sent in a topic are tagged with `topic_id` |
| SG-05 | The topic WebSocket stream delivers only messages for that topic |

### 3.6 Real-Time Messaging

| ID | Requirement |
|----|-------------|
| RT-01 | Connecting to a chat or group opens a WebSocket and messages arrive without polling |
| RT-02 | Outgoing messages are sent over WebSocket when connected; the app falls back to REST POST if the socket is closed |
| RT-03 | Incoming WebSocket messages are appended to the message list without a full reload |
| RT-04 | Messages show a "pending" indicator while in flight and resolve when confirmed |
| RT-05 | Switching between chats/groups tears down the previous socket and opens a new one |

### 3.7 Presence & Typing Indicators

| ID | Requirement |
|----|-------------|
| PRS-01 | A global presence socket connects on login and disconnects on logout |
| PRS-02 | Online users are shown with a green indicator in the sidebar and message panel header |
| PRS-03 | A keepalive ping is sent every 30 seconds to maintain the presence connection |
| PRS-04 | When the user is typing a typing event is sent over the presence socket, throttled to once every 2 seconds |
| PRS-05 | Typing indicators from other users are displayed in the message panel header |
| PRS-06 | A typing indicator clears after 3 seconds of inactivity from that user |

### 3.8 Notifications

| ID | Requirement |
|----|-------------|
| NTF-01 | A notification socket connects on login and receives real-time pushes |
| NTF-02 | New notifications are shown as in-app toasts that auto-dismiss after 4.5 seconds |
| NTF-03 | The sidebar has a notifications section listing historical notifications from the REST API |
| NTF-04 | Tapping a notification marks it as read via the REST API |

### 3.9 User Profiles

| ID | Requirement |
|----|-------------|
| PRF-01 | Clicking the current user's avatar opens a right panel with profile edit controls |
| PRF-02 | Users can update their avatar (image upload), description, and status |
| PRF-03 | Clicking another user's name/avatar opens their profile in the right panel (read-only) |
| PRF-04 | Profile panel is toggled — clicking the same target a second time closes it |

### 3.10 Group Info Panel

| ID | Requirement |
|----|-------------|
| GI-01 | Clicking the group name in the header opens a right panel with group details |
| GI-02 | The panel lists all members with their roles |
| GI-03 | Admins/owners see an "Add member" control; regular members do not |
| GI-04 | Adding a member triggers a user search and distributes the group key to the selected user |

---

## 4. Non-Functional Requirements

### 4.1 Security

- Private keys are derived in-browser via Web Crypto API and never transmitted
- The server only receives ciphertext and IVs; plaintext is never sent
- JWT tokens are stored in localStorage and included in all API requests
- CORS policy on the backend restricts origins to configured frontend URLs

### 4.2 Performance

- Initial page load (cold): < 3 s on a 10 Mbps connection
- WebSocket message end-to-end latency (LAN): < 150 ms
- Crypto operations (encrypt/decrypt single message): < 10 ms
- Sidebar renders up to 100 chats/groups without virtualization in v1

### 4.3 Compatibility

- Target: latest two versions of Chrome, Firefox, Safari, Edge
- Web Crypto API required (no IE11 support)
- Minimum viewport: 768 px width (desktop-first in v1)

### 4.4 Reliability

- Presence socket ping every 30 s prevents idle disconnection
- REST fallback for message sending when WebSocket is unavailable
- Token refresh transparently retries failed requests

---

## 5. Component Inventory

| Component | File | Responsibility |
|-----------|------|----------------|
| `AuthView` | `components/AuthView.tsx` | Login / register form with mode toggle |
| `ChatSidebar` | `components/ChatSidebar.tsx` | Left panel: chats, groups, topics, user search, notifications, create buttons |
| `MessagePanel` | `components/MessagePanel.tsx` | Message history, input, attachment picker, typing indicators, online indicator |
| `ProfilePanel` | `components/ProfilePanel.tsx` | Right drawer: view/edit own profile or view another user's profile |
| `GroupInfoPanel` | `components/GroupInfoPanel.tsx` | Right drawer: group details, member list, add-member control |
| `MnemonicSetupModal` | `components/MnemonicSetupModal.tsx` | E2E identity setup: generate or restore 12-word mnemonic |
| `AttachmentView` | `components/AttachmentView.tsx` | Render image/video/audio/file attachments inside messages |
| `RightDrawer` | `components/RightDrawer.tsx` | Shared layout wrapper for all right-panel content |
| `ToastProvider` | `components/ToastProvider.tsx` | App-wide toast notification context; 4.5 s auto-dismiss |

---

## 6. Hook Inventory

| Hook | File | Responsibility |
|------|------|----------------|
| `useChatPageController` | `hooks/useChatPageController.ts` | Wires together all sub-hooks; single mount point for the page |
| `useChatActions` | `hooks/useChatActions.ts` | All async business logic: bootstrap, send message, create group, add member, etc. |
| `useChatSocket` | `hooks/useChatSocket.ts` | Manages the active chat/group/topic WebSocket lifecycle |
| `usePresenceSocket` | `hooks/usePresenceSocket.ts` | Manages global presence WebSocket; emits ping and typing events |
| `useNotificationSocket` | `hooks/useNotificationSocket.ts` | Manages notification WebSocket; updates store on push |
| `useTokenStore` | `hooks/useTokenStore.ts` | Reads persisted tokens from `sessionStore` |
| `useMessageDisplay` | `hooks/useMessageDisplay.ts` | Decrypts messages from store before passing to render |

---

## 7. State Management

### 7.1 `chatStore` (Zustand)

| Slice | Key Fields |
|-------|-----------|
| Auth | `me`, `authMode`, `username`, `email`, `password` |
| Rooms | `roomType`, `activeDirectId`, `activeGroupId`, `activeTopicId` |
| Data | `users[]`, `directChats[]`, `groups[]`, `topics[]`, `messages[]`, `notifications[]` |
| Profiles | `myProfile`, `userProfiles{userId}`, `groupDetails{groupId}`, `groupMembers{groupId}` |
| Crypto | `publicKeys{userId}`, `pendingAttachments{localId}` |
| UI | `messageInput`, `status`, `error`, `rightPanel`, `createGroup*`, `newTopicTitle` |
| Presence | `onlineUsers{userId: bool}`, `typingUsers{roomKey: userId[]}` |
| Flags | `mnemonicRequired` |

### 7.2 `sessionStore` (Zustand with localStorage persistence)

- Persists `{ access, refresh }` tokens under key `onlinechatfront.tokens`
- Rehydrated automatically on page load

### 7.3 Selectors (`chatSelectors.ts`)

| Selector | Used by |
|----------|---------|
| `useAuthSlice` | `AuthView` |
| `useHeaderSlice` | Page header |
| `useSidebarSlice` | `ChatSidebar` |
| `useMessagePanelSlice` | `MessagePanel` |
| `useRightPanelSlice` | `ProfilePanel`, `GroupInfoPanel` |

---

## 8. Encryption Design

```
Identity Setup
  mnemonic (12 words)
    → PBKDF2 (SHA-256, 100k iterations)
    → ECDH P-256 key pair
    → publicJwk uploaded to backend
    → privateKey stored in localStorage (oc:identity:v2)

Direct Message Encryption
  myPrivateKey + recipientPublicKey
    → ECDH deriveBits → raw shared secret
    → importKey as AES-256-GCM key
    → encrypt(plaintext) → { ciphertext (base64), iv (base64) }

Group Message Encryption
  groupAesKey (AES-256-GCM, stored per group)
    → encrypt(plaintext) → { ciphertext, iv }

Group Key Distribution (per new member)
  recipientPublicKey
    → ECDH derive shared secret with own private key
    → encrypt(groupAesKey raw bytes) → { ciphertext, iv }
    → POST to /api/chats/groups/{id}/e2e-key/
```

---

## 9. WebSocket Connection Map

| Socket | URL Pattern | Direction | Purpose |
|--------|-------------|-----------|---------|
| Chat (direct) | `/ws/chats/{chatId}/?token=…` | ↕ | Send/receive direct messages |
| Chat (group) | `/ws/groups/{groupId}/?token=…` | ↕ | Send/receive group messages |
| Chat (topic) | `/ws/groups/{groupId}/topics/{topicId}/?token=…` | ↕ | Send/receive topic messages |
| Presence | `/ws/presence/?token=…` | ↕ | Online/offline events + typing |
| Notifications | `/ws/notifications/?token=…` | ← | Receive notification pushes |

---

## 10. Known Bugs

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| BUG-01 | Low | `AttachmentView.tsx:26` | `console.log(attachments)` left in production code |
| BUG-02 | Medium | `AttachmentView.tsx:85` | File size always displays "1 B" — `formatSize(1)` hardcoded instead of using actual file size |
| BUG-03 | Medium | `useChatSocket.ts` | No auto-reconnect after WebSocket drops due to network interruption |
| BUG-04 | Medium | `useChatActions.ts` | Group key distribution to new members is wrapped in a silent try/catch — failures are non-fatal, leaving members unable to decrypt |
| BUG-05 | Low | `mnemonic.ts` | `isValidMnemonic()` accepts any phrase with 8+ words; no entropy or word-list validation |

---

## 11. Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Login / Register | Done | |
| JWT token persistence & refresh | Done | |
| E2E identity (mnemonic → ECDH key pair) | Done | |
| Direct chat messaging (E2E encrypted) | Done | |
| Group chat messaging (E2E encrypted) | Done | |
| Supergroup topics | Done | |
| File attachments (image/video/audio/file) | Done | File size display bug (BUG-02) |
| Real-time WebSocket messaging | Done | No auto-reconnect (BUG-03) |
| Presence (online/offline indicators) | Done | |
| Typing indicators | Done | Client-side 3 s timeout |
| In-app toast notifications | Done | |
| User profile view/edit | Done | |
| Group info panel & add member | Done | Key distribution may fail silently (BUG-04) |
| Message pagination / virtual scroll | Not done | All messages loaded at once |
| WebSocket auto-reconnect | Not done | |
| Message editing / deletion | Not done | Planned v2 |
| Read receipts | Not done | Planned v2 |
| Message search | Not done | Planned v2 |
| Offline draft persistence | Not done | |
| Mobile / responsive layout | Not done | Desktop-first in v1 |
| Dark / light theme toggle | Not done | Dark only in v1 |

---

## 12. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `"use client"` SPA) |
| UI Library | React 19 |
| Language | TypeScript 5 (strict mode) |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 + custom CSS variables (dark Telegram theme) |
| Cryptography | Web Crypto API + `@noble/curves` 2.2.0 |
| HTTP | Fetch API (no axios) |
| Real-time | Native WebSocket API |
| Fonts | Geist (Next.js built-in) |
| Linting | ESLint (Next.js config) |

---

## 13. Future Considerations (v2)

- **Message pagination** — virtual scroll with cursor-based API pagination
- **WebSocket auto-reconnect** — exponential back-off with jitter
- **Read receipts** — per-message delivery and seen status
- **Message editing & deletion** — with edit history trail
- **Offline drafts** — IndexedDB or service worker message queue
- **Mobile responsive layout** — collapsible sidebar, touch-optimized input
- **Dark / light theme toggle** — CSS variable swap
- **Message search** — full-text search over decrypted local cache
- **Reactions & emoji** — lightweight reaction bar per message
- **Voice messages** — MediaRecorder API → audio attachment
