import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../../environments/environment';
import { Message } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private hubConnection?: HubConnection;
  private connectionStateSubject = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);
  public connectionState$ = this.connectionStateSubject.asObservable();

  // Message events
  private messageSubject = new Subject<{ chatId: number; message: Message }>();
  public message$ = this.messageSubject.asObservable();

  private newMessageSubject = new Subject<{ chatId: number; message: Message }>();
  public newMessage$ = this.newMessageSubject.asObservable();

  // Typing events
  private typingSubject = new Subject<{ chatId: number; userId: number; isTyping: boolean }>();
  public typing$ = this.typingSubject.asObservable();

  // Call events
  private incomingCallSubject = new Subject<{ chatId: number; roomName: string; callType: string; callerId: number }>();
  public incomingCall$ = this.incomingCallSubject.asObservable();

  private userJoinedCallSubject = new Subject<{ chatId: number; roomName: string; userId: number }>();
  public userJoinedCall$ = this.userJoinedCallSubject.asObservable();

  private userLeftCallSubject = new Subject<{ chatId: number; roomName: string; userId: number }>();
  public userLeftCall$ = this.userLeftCallSubject.asObservable();

  private messageUpdatedSubject = new Subject<{ chatId: number; message: Message }>();
  public messageUpdated$ = this.messageUpdatedSubject.asObservable();

  constructor(private authService: AuthService) {}

  async startConnection(): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      // Ensure handlers are registered even if connection already exists
      if (this.hubConnection) {
        console.log('[SignalR] Connection already exists, re-registering handlers...');
        this.registerHandlers();
      }
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const apiUrl = environment.apiUrl.replace('/api', '');
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${apiUrl}/chathub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 10s, 30s, then 30s intervals
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        }
      })
      .build();

    // Register event handlers
    this.registerHandlers();

    // Update connection state
    this.hubConnection.onclose(() => {
      this.connectionStateSubject.next(HubConnectionState.Disconnected);
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionStateSubject.next(HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStateSubject.next(HubConnectionState.Connected);
    });

    try {
      await this.hubConnection.start();
      this.connectionStateSubject.next(HubConnectionState.Connected);
      console.log('[SignalR] Connection established successfully');
    } catch (error) {
      console.error('[SignalR] Error starting connection:', error);
      this.connectionStateSubject.next(HubConnectionState.Disconnected);
      throw error;
    }
  }

  private registerHandlers(): void {
    if (!this.hubConnection) {
      console.warn('[SignalR] Cannot register handlers: hubConnection is null');
      return;
    }

    console.log('[SignalR] Registering event handlers...');
    console.log('[SignalR] Connection state:', this.hubConnection.state);
    console.log('[SignalR] Connection ID:', this.hubConnection.connectionId);
    
    // Remove existing handlers first to prevent duplicates
    this.hubConnection.off('ReceiveMessage');
    this.hubConnection.off('MessageUpdated');
    this.hubConnection.off('NewMessage');
    this.hubConnection.off('UserTyping');
    this.hubConnection.off('IncomingCall');
    this.hubConnection.off('UserJoinedCall');
    this.hubConnection.off('UserLeftCall');
    
    // Test: Listen for ANY event to verify SignalR is working
    this.hubConnection.onreconnecting((error) => {
      console.log('[SignalR] Reconnecting...', error);
    });
    
    this.hubConnection.onreconnected((connectionId) => {
      console.log('[SignalR] Reconnected with connection ID:', connectionId);
    });
    
    this.hubConnection.on('ReceiveMessage', (chatId: number, message: Message) => {
      console.log(`[SignalR] ✅✅✅ ReceiveMessage event received: message ${message.messageId} for chat ${chatId}`);
      console.log(`[SignalR] Message details:`, {
        messageId: message.messageId,
        chatId,
        senderId: message.senderId,
        content: message.content?.substring(0, 50)
      });
      this.messageSubject.next({ chatId, message });
    });

    // Debug: Listen for all events to see what's happening
    this.hubConnection.on('NewMessage', (chatId: number, message: Message) => {
      console.log(`[SignalR] 📨📨📨 NewMessage event received: message ${message.messageId} for chat ${chatId}`);
      console.log(`[SignalR] NewMessage details:`, {
        messageId: message.messageId,
        chatId,
        senderId: message.senderId,
        content: message.content?.substring(0, 50)
      });
      this.newMessageSubject.next({ chatId, message });
    });
    
    console.log('[SignalR] ✅ Event handlers registered successfully');
    console.log('[SignalR] Hub connection state:', this.hubConnection.state);
    if (this.hubConnection.connectionId) {
      console.log('[SignalR] Hub connection ID:', this.hubConnection.connectionId);
    }

    // NewMessage is for chat list updates and notifications
    this.hubConnection.on('NewMessage', (chatId: number, message: Message) => {
      console.log(`[SignalR] NewMessage event (chat list update): message ${message.messageId} for chat ${chatId}`);
      this.newMessageSubject.next({ chatId, message });
    });

    this.hubConnection.on('UserTyping', (chatId: number, userId: number, isTyping: boolean) => {
      this.typingSubject.next({ chatId, userId, isTyping });
    });

    this.hubConnection.on('IncomingCall', (chatId: number, roomName: string, callType: string, callerId: number) => {
      this.incomingCallSubject.next({ chatId, roomName, callType, callerId });
    });

    this.hubConnection.on('UserJoinedCall', (chatId: number, roomName: string, userId: number) => {
      this.userJoinedCallSubject.next({ chatId, roomName, userId });
    });

    this.hubConnection.on('UserLeftCall', (chatId: number, roomName: string, userId: number) => {
      this.userLeftCallSubject.next({ chatId, roomName, userId });
    });

    this.hubConnection.on('MessageUpdated', (chatId: number, message: Message) => {
      console.log(`[SignalR] ✅✅✅ MessageUpdated event received: message ${message.messageId} for chat ${chatId}`);
      console.log(`[SignalR] Updated message details:`, { 
        messageId: message.messageId, 
        chatId, 
        content: message.content?.substring(0, 50),
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        senderId: message.senderId,
        senderName: message.senderName
      });
      console.log(`[SignalR] Emitting to messageUpdatedSubject...`);
      try {
        this.messageUpdatedSubject.next({ chatId, message });
        console.log(`[SignalR] ✅ Successfully emitted MessageUpdated to subject`);
      } catch (error) {
        console.error(`[SignalR] ❌ Error emitting MessageUpdated to subject:`, error);
      }
    });
    
    console.log('[SignalR] ✅ MessageUpdated handler registered');
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.connectionStateSubject.next(HubConnectionState.Disconnected);
    }
  }

  async joinChat(chatId: number): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      try {
        console.log(`[SignalR] Invoking JoinChat for chat ${chatId}...`);
        await this.hubConnection.invoke('JoinChat', chatId);
        console.log(`[SignalR] ✅ Successfully joined chat ${chatId}`);
        
        // Verify we're in the group by checking connection state
        console.log(`[SignalR] Connection state after join: ${this.hubConnection.state}`);
      } catch (error) {
        console.error(`[SignalR] ❌ Error joining chat ${chatId}:`, error);
        throw error;
      }
    } else {
      console.warn(`[SignalR] Cannot join chat ${chatId}: SignalR not connected (state: ${this.hubConnection?.state})`);
      // Try to reconnect
      try {
        await this.startConnection();
        await this.hubConnection?.invoke('JoinChat', chatId);
        console.log(`[SignalR] ✅ Reconnected and joined chat ${chatId}`);
      } catch (error) {
        console.error(`[SignalR] ❌ Failed to reconnect and join chat ${chatId}:`, error);
        throw error;
      }
    }
  }

  async leaveChat(chatId: number): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('LeaveChat', chatId);
    }
  }

  async sendMessage(chatId: number, message: Message): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('SendMessage', chatId, message);
    }
  }

  async sendTypingIndicator(chatId: number, isTyping: boolean): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('TypingIndicator', chatId, isTyping);
    }
  }

  async createJitsiRoom(chatId: number, roomName: string, callType: string): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('CreateJitsiRoom', chatId, roomName, callType);
    }
  }

  async joinJitsiRoom(chatId: number, roomName: string): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('JoinJitsiRoom', chatId, roomName);
    }
  }

  async leaveJitsiRoom(chatId: number, roomName: string): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('LeaveJitsiRoom', chatId, roomName);
    }
  }

  getConnectionState(): HubConnectionState {
    return this.hubConnection?.state ?? HubConnectionState.Disconnected;
  }
}

