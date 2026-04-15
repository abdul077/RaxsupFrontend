import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ChatService } from '../../../core/services/chat.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { AuthService } from '../../../core/services/auth';
import { AdminService } from '../../../core/services/admin.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { Chat, Message, MessagingUser } from '../../../core/models/chat.model';
import { Subject, takeUntil, filter } from 'rxjs';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.scss',
})
export class ChatListComponent implements OnInit, OnDestroy {
  chats: Chat[] = [];
  showCreateModal = false;
  chatType: 'direct' | 'group' = 'direct';
  users: MessagingUser[] = [];
  selectedUserId?: number;
  groupName = '';
  selectedUserIds: number[] = [];
  searchTerm = '';
  loadingUsers = false;
  private destroy$ = new Subject<void>();
  private chatRefreshInterval?: any;

  constructor(
    private chatService: ChatService,
    private signalRService: SignalRService,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private datePipe: DatePipe,
    private timeZoneService: TimeZoneService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.initializeSignalR();
    this.loadChats();
    this.loadUsers();

    // Start periodic refresh to ensure chats stay up to date (every 30 seconds)
    this.startPeriodicRefresh();

    // Subscribe to new messages to update chat list
    this.signalRService.newMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ chatId, message }) => {
        console.log(`[ChatList] 📨📨📨 New message received for chat ${chatId}:`, message);
        this.updateChatWithNewMessage(chatId, message);
        console.log(`[ChatList] ✅✅✅ Chat list updated for chat ${chatId}`);
      });

    // Reload chats when navigating back to the messaging page
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        if (event.url === '/messaging' || event.urlAfterRedirects === '/messaging') {
          this.loadChats();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPeriodicRefresh();
  }

  private async initializeSignalR(): Promise<void> {
    try {
      console.log('[ChatList] 🔌🔌🔌 Initializing SignalR connection...');
      await this.signalRService.startConnection();
      console.log('[ChatList] ✅✅✅ SignalR connection initialized');

      const connectionState = this.signalRService.getConnectionState();
      console.log('[ChatList] SignalR connection state:', connectionState);
    } catch (error) {
      console.error('[ChatList] ❌❌❌ Failed to start SignalR connection:', error);
    }
  }

  loadChats(): void {
    this.chatService.getUserChats().subscribe({
      next: (chats) => {
        this.chats = chats;
      },
      error: (error) => {
        console.error('Error loading chats:', error);
        this.chats = [];
      }
    });
  }

  private updateChatWithNewMessage(chatId: number, message: Message): void {
    console.log(`[ChatList] 🔄🔄🔄 Updating chat ${chatId} with message:`, message.content?.substring(0, 50));

    const chat = this.chats.find(c => c.chatId === chatId);
    if (chat) {
      console.log(`[ChatList] Found chat ${chatId}, updating...`);
      chat.lastMessageAt = message.sentAt;
      chat.lastMessagePreview = message.content.length > 50
        ? message.content.substring(0, 50) + '...'
        : message.content;

      // Increment unread count if not the current user's message
      const currentUser = this.authService.getCurrentUser();
      if (currentUser && message.senderId !== currentUser.userId) {
        chat.unreadCount++;
        console.log(`[ChatList] Incremented unread count to ${chat.unreadCount} for chat ${chatId}`);
      }

      // Move to top
      this.chats = this.chats.filter(c => c.chatId !== chatId);
      this.chats.unshift(chat);
      console.log(`[ChatList] Moved chat ${chatId} to top of list`);

      // Trigger change detection to update the UI
      this.cdr.detectChanges();
      console.log(`[ChatList] Change detection triggered for chat ${chatId}`);
    } else {
      console.log(`[ChatList] ❌❌❌ Chat ${chatId} not found in chat list!`);
      console.log(`[ChatList] Available chats:`, this.chats.map(c => c.chatId));

      // If chat is not in the list, it might not be loaded yet. Reload chats.
      console.log(`[ChatList] 🔄🔄🔄 Reloading chats to find chat ${chatId}...`);
      this.loadChats();
    }
  }

  getChatDisplayName(chat: Chat): string {
    if (chat.chatType === 'Group') {
      return chat.groupName || 'Group Chat';
    }
    
    // For direct chats, show the other participant's name
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const otherParticipant = chat.participants.find(p => p.userId !== currentUser.userId);
      return otherParticipant?.fullName || otherParticipant?.userName || 'Unknown User';
    }
    
    return 'Chat';
  }

  getChatAvatar(chat: Chat): string {
    // Return first letter of display name
    const name = this.getChatDisplayName(chat);
    return name.charAt(0).toUpperCase();
  }

  openChat(chatId: number): void {
    this.router.navigate(['/messaging', chatId]);
  }

  createNewChat(): void {
    this.chatType = 'direct';
    this.selectedUserId = undefined;
    this.groupName = '';
    this.selectedUserIds = [];
    this.searchTerm = '';
    this.showCreateModal = true;
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.chatService.getMessagingUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loadingUsers = false;
      },
      error: () => {
        this.users = [];
        this.loadingUsers = false;
      }
    });
  }

  getFilteredUsers(): MessagingUser[] {
    if (!this.searchTerm) {
      return this.users;
    }
    const term = this.searchTerm.toLowerCase();
    return this.users.filter(u => 
      (u.fullName?.toLowerCase().includes(term)) ||
      (u.username?.toLowerCase().includes(term)) ||
      (u.email?.toLowerCase().includes(term))
    );
  }

  toggleUserSelection(userId: number): void {
    const index = this.selectedUserIds.indexOf(userId);
    if (index > -1) {
      this.selectedUserIds.splice(index, 1);
    } else {
      this.selectedUserIds.push(userId);
    }
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUserIds.includes(userId);
  }

  createDirectChat(): void {
    if (!this.selectedUserId) {
      return;
    }

    this.chatService.createChat({ otherUserId: this.selectedUserId }).subscribe({
      next: (chatId) => {
        this.showCreateModal = false;
        this.loadChats();
        this.router.navigate(['/messaging', chatId]);
      },
      error: (error) => {
        console.error('Error creating chat:', error);
        const errorMessage = error?.error?.message || error?.message || 'Failed to create chat. Please try again.';
        alert(`Failed to create chat: ${errorMessage}`);
      }
    });
  }

  createGroupChat(): void {
    if (!this.groupName.trim() || this.selectedUserIds.length === 0) {
      alert('Please enter a group name and select at least one member.');
      return;
    }

    this.chatService.createGroupChat({
      groupName: this.groupName.trim(),
      userIds: this.selectedUserIds
    }).subscribe({
      next: (chatId) => {
        this.showCreateModal = false;
        this.loadChats();
        // Small delay to ensure backend has saved all participants
        setTimeout(() => {
          // Navigate to the chat - it will load with all participants
          this.router.navigate(['/messaging', chatId]);
        }, 300);
      },
      error: (error) => {
        console.error('Error creating group chat:', error);
        const errorMessage = error?.error?.message || error?.message || 'Failed to create group chat. Please try again.';
        alert(`Failed to create group chat: ${errorMessage}`);
      }
    });
  }

  onCreateChat(): void {
    if (this.chatType === 'direct') {
      this.createDirectChat();
    } else {
      this.createGroupChat();
    }
  }

  formatTime(dateString: string): string {
    return this.timeZoneService.getRelativeTime(dateString);
  }

  private startPeriodicRefresh(): void {
    // Clear any existing interval
    this.stopPeriodicRefresh();

    // Set up periodic refresh every 30 seconds
    this.chatRefreshInterval = setInterval(() => {
      console.log('[ChatList] 🔄🔄🔄 Periodic refresh: reloading chats...');
      this.loadChats();
    }, 30000); // 30 seconds

    console.log('[ChatList] ✅✅✅ Periodic refresh started');
  }

  private stopPeriodicRefresh(): void {
    if (this.chatRefreshInterval) {
      clearInterval(this.chatRefreshInterval);
      this.chatRefreshInterval = undefined;
      console.log('[ChatList] 🛑🛑🛑 Periodic refresh stopped');
    }
  }
}

