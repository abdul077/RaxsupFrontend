export interface Chat {
  chatId: number;
  chatType: string; // Direct, Group
  groupName?: string;
  createdBy: number;
  creatorName?: string;
  createdAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  participants: ChatParticipant[];
}

export interface ChatParticipant {
  chatParticipantId: number;
  chatId: number;
  userId: number;
  userName?: string;
  fullName?: string;
  role: string; // Member, Admin
  joinedAt: string;
  unreadCount: number;
}

export interface Message {
  messageId: number;
  chatId: number;
  senderId: number;
  senderName?: string;
  senderRole?: string;
  content: string;
  messageType: string; // Text, Image, File
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  sentAt: string;
  readAt?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
}

export interface Call {
  callId: number;
  chatId: number;
  callerId: number;
  callerName?: string;
  callType: string; // Voice, Video, Jitsi
  status: string; // Initiated, Ringing, Accepted, Rejected, Ended, Missed
  jitsiRoomName?: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  participants: CallParticipant[];
}

export interface CallParticipant {
  callParticipantId: number;
  callId: number;
  userId: number;
  userName?: string;
  fullName?: string;
  joinedAt: string;
  leftAt?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface CreateChatRequest {
  otherUserId: number;
}

export interface CreateGroupChatRequest {
  groupName: string;
  userIds: number[];
}

export interface SendMessageRequest {
  content: string;
  messageType?: string; // Text, Image, File
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface CreateJitsiRoomRequest {
  chatId: number;
  callType: string; // Voice, Video
}

export interface JitsiRoomInfo {
  roomName: string;
  chatId: number;
  callerId: number;
  callerName?: string;
  callType: string;
}

export interface UploadMessageFileResponse {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  messageType: string; // Image, File
}

export interface MessagingUser {
  userId: number;
  username: string;
  fullName?: string;
  email?: string;
}

