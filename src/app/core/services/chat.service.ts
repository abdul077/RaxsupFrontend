import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  Chat,
  Message,
  CreateChatRequest,
  CreateGroupChatRequest,
  SendMessageRequest,
  CreateJitsiRoomRequest,
  JitsiRoomInfo,
  ChatParticipant,
  PagedResult,
  UploadMessageFileResponse,
  MessagingUser
} from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  constructor(private apiService: ApiService) {}

  getUserChats(): Observable<Chat[]> {
    return this.apiService.get<Chat[]>('chats');
  }

  getMessagingUsers(): Observable<MessagingUser[]> {
    return this.apiService.get<MessagingUser[]>('chats/users');
  }

  getChatById(id: number): Observable<Chat> {
    return this.apiService.get<Chat>(`chats/${id}`);
  }

  createChat(request: CreateChatRequest): Observable<number> {
    return this.apiService.post<number>('chats', request);
  }

  createGroupChat(request: CreateGroupChatRequest): Observable<number> {
    return this.apiService.post<number>('chats/group', request);
  }

  getChatMessages(
    chatId: number,
    pageNumber: number = 1,
    pageSize: number = 50,
    beforeDate?: Date
  ): Observable<PagedResult<Message>> {
    const params: any = {
      pageNumber,
      pageSize
    };
    if (beforeDate) {
      params.beforeDate = beforeDate.toISOString();
    }
    // Skip loading indicator for message loads (background polling/real-time updates)
    return this.apiService.get<PagedResult<Message>>(`chats/${chatId}/messages`, params, { 'X-Skip-Loading': 'true' });
  }

  sendMessage(chatId: number, request: SendMessageRequest): Observable<number> {
    // Skip loading indicator for message sends (optimistic UI)
    return this.apiService.post<number>(`chats/${chatId}/messages`, request, { 'X-Skip-Loading': 'true' });
  }

  getGroupChatMembers(chatId: number): Observable<ChatParticipant[]> {
    return this.apiService.get<ChatParticipant[]>(`chats/${chatId}/members`);
  }

  addGroupMember(chatId: number, userId: number): Observable<void> {
    return this.apiService.post<void>(`chats/${chatId}/members`, { userId });
  }

  removeGroupMember(chatId: number, userId: number): Observable<void> {
    return this.apiService.delete<void>(`chats/${chatId}/members/${userId}`);
  }

  createJitsiRoom(request: CreateJitsiRoomRequest): Observable<JitsiRoomInfo> {
    return this.apiService.post<JitsiRoomInfo>('jitsi/create-room', request);
  }

  getJitsiRoomInfo(roomName: string): Observable<JitsiRoomInfo> {
    return this.apiService.get<JitsiRoomInfo>(`jitsi/room/${roomName}`);
  }

  editMessage(messageId: number, content: string): Observable<void> {
    // Skip loading indicator for message edits (optimistic UI)
    return this.apiService.put<void>(`chats/messages/${messageId}`, { content }, { 'X-Skip-Loading': 'true' });
  }

  deleteMessage(messageId: number): Observable<void> {
    return this.apiService.delete<void>(`chats/messages/${messageId}`);
  }

  uploadMessageFile(file: File): Observable<UploadMessageFileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    // Skip loading indicator for file uploads (optimistic UI)
    return this.apiService.postFile<UploadMessageFileResponse>('chats/messages/upload', formData, { 'X-Skip-Loading': 'true' });
  }

  downloadMessageFile(messageId: number): string {
    return `${this.apiService['apiUrl']}/chats/messages/${messageId}/download`;
  }

  viewMessageFile(messageId: number): string {
    return `${this.apiService['apiUrl']}/chats/messages/${messageId}/view`;
  }

  markChatAsRead(chatId: number): Observable<void> {
    return this.apiService.put<void>(`chats/${chatId}/read`, {});
  }
}

