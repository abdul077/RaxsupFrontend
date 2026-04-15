import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '../../../core/services/chat.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { JitsiService } from '../../../core/services/jitsi.service';
import { AuthService } from '../../../core/services/auth';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { Chat, Message, SendMessageRequest, MessagingUser } from '../../../core/models/chat.model';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { HubConnectionState } from '@microsoft/signalr';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss',
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;
  @ViewChild('messageInput') private messageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  chat: Chat | null = null;
  messages: Message[] = [];
  loading = false; // Don't show loader initially
  messageContent = '';
  typingUsers: Set<number> = new Set();
  showCallModal = false;
  isInCall = false;
  currentRoomName: string | null = null;
  currentCallType: string = 'Video';
  private processedMessageIds: Set<number> = new Set(); // Track processed message IDs to prevent duplicates
  private pendingOptimisticMessages: Map<string, number> = new Map(); // Track optimistic messages by content+sender+time to prevent duplicates
  imageLoadErrors = new Set<number>();
  imageBlobUrls = new Map<number, string>(); // Store blob URLs for images

  // Voice recording properties
  isRecording = false;
  recordedAudio: Blob | null = null;
  audioUrl: string | null = null;
  recordingTime = 0;
  recordingInterval: any;
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];
  showImageModal = false;
  selectedImageMessage: Message | null = null;
  showEmojiPicker: boolean = false;
  uploadingFile: boolean = false;
  selectedFile: File | null = null;
  filePreviewUrl: string | null = null;

  // Group members management
  showMembersPanel = false;
  showAddMemberModal = false;
  availableUsers: MessagingUser[] = [];
  memberSearchTerm = '';
  leavingGroup = false;

  private chatId: number = 0;
  private destroy$ = new Subject<void>();
  private typingTimeout: any;
  private shouldScrollToBottom = false;
  private pageNumber = 1;
  hasMoreMessages = true;
  private messagePollInterval: any; // For fallback polling when SignalR fails

  constructor(
    public route: ActivatedRoute,
    public router: Router,
    private chatService: ChatService,
    private signalRService: SignalRService,
    private jitsiService: JitsiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe,
    private timeZoneService: TimeZoneService
  ) { }

  async ngOnInit(): Promise<void> {
    this.chatId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.chatId) {
      this.router.navigate(['/messaging']);
      return;
    }

    console.log(`[ChatWindow] Initializing chat window for chat ${this.chatId}`);

    // Setup SignalR subscriptions FIRST (before loading messages)
    this.setupSignalRSubscriptions();
    console.log(`[ChatWindow] SignalR subscriptions set up`);

    // Initialize SignalR connection and join chat
    await this.initializeSignalR();

    // Load chat info and initial messages
    this.loadChat();
    this.loadMessages();

    // Start periodic polling as fallback (every 5 seconds) if SignalR fails
    this.startMessagePolling();

    // Close emoji picker when clicking outside
    document.addEventListener('click', this.handleClickOutside.bind(this));
    
    console.log(`[ChatWindow] Chat window initialized for chat ${this.chatId}`);
  }
  
  private startMessagePolling(): void {
    // Poll every 3 seconds to check for new messages (fallback if SignalR fails)
    // More frequent polling ensures messages appear quickly
    this.messagePollInterval = setInterval(() => {
      if (this.chatId) {
        // Use silent reload to avoid showing loader
        // Poll even if messages array is empty (for initial load)
        this.reloadMessagesSilently();
      }
    }, 3000); // Poll every 3 seconds for faster updates
  }
  
  private stopMessagePolling(): void {
    if (this.messagePollInterval) {
      clearInterval(this.messagePollInterval);
      this.messagePollInterval = null;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.chatId) {
      this.signalRService.leaveChat(this.chatId);
    }
    document.removeEventListener('click', this.handleClickOutside.bind(this));
    this.stopMessagePolling();
    this.destroy$.next();
    this.destroy$.complete();
    this.jitsiService.dispose();

    // Clean up blob URLs to prevent memory leaks
    this.imageBlobUrls.forEach(url => URL.revokeObjectURL(url));
    this.imageBlobUrls.clear();
  }

  private handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const emojiPicker = document.querySelector('.emoji-picker');
    const emojiBtn = document.querySelector('.emoji-btn');

    if (this.showEmojiPicker &&
      emojiPicker &&
      !emojiPicker.contains(target) &&
      emojiBtn &&
      !emojiBtn.contains(target)) {
      this.showEmojiPicker = false;
      this.cdr.detectChanges();
    }
  }

  private async initializeSignalR(): Promise<void> {
    try {
      // Start connection if not already connected
      const connectionState = this.signalRService.getConnectionState();
      console.log(`[ChatWindow] Current SignalR connection state: ${connectionState}`);
      
      if (connectionState !== HubConnectionState.Connected) {
        console.log(`[ChatWindow] Starting SignalR connection...`);
        await this.signalRService.startConnection();
        // Wait for connection to fully establish
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const newState = this.signalRService.getConnectionState();
        console.log(`[ChatWindow] SignalR connection state after start: ${newState}`);
      } else {
        console.log(`[ChatWindow] SignalR already connected - ensuring handlers are registered`);
        // Ensure handlers are registered even if connection already exists
        await this.signalRService.startConnection(); // This will re-register handlers
      }

      // Join chat group
      console.log(`[ChatWindow] Joining chat group ${this.chatId}...`);
      await this.signalRService.joinChat(this.chatId);
      console.log(`[ChatWindow] ✅ SignalR initialized and joined chat ${this.chatId}`);
      
      // Verify connection state one more time
      const finalState = this.signalRService.getConnectionState();
      console.log(`[ChatWindow] Final SignalR connection state: ${finalState}`);
      
      // Verify subscription is active
      console.log(`[ChatWindow] MessageUpdated subscription should be active now`);
    } catch (error) {
      console.error('[ChatWindow] ❌ Failed to start SignalR connection:', error);
      // Retry after 2 seconds
      setTimeout(() => {
        this.initializeSignalR();
      }, 2000);
    }
  }

  private setupSignalRSubscriptions(): void {
    console.log(`[ChatWindow] Setting up SignalR subscriptions for chat ${this.chatId}`);
    console.log(`[ChatWindow] Current chatId: ${this.chatId}`);
    
    // Subscribe to new messages
    this.signalRService.message$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ chatId, message }) => {
        if (chatId === this.chatId) {
          console.log(`[SignalR] Received message ${message.messageId} for chat ${chatId}`, message);

          // Check if we've already processed this message ID
          if (message.messageId > 0 && this.processedMessageIds.has(message.messageId)) {
            console.log(`[SignalR] ⚠️ Message ${message.messageId} already processed, skipping duplicate`);
            return;
          }

          // Check if message already exists by messageId
          if (message.messageId > 0) {
            const existingIndex = this.messages.findIndex(m => m.messageId === message.messageId);
            if (existingIndex > -1) {
              console.log(`[SignalR] ⚠️ Message ${message.messageId} already exists, skipping duplicate`);
              this.processedMessageIds.add(message.messageId);
              return;
            }
          }

          // Add message to chat (SignalR is the single source of truth)
          this.messages = [...this.messages, { ...message }];
          if (message.messageId > 0) {
            this.processedMessageIds.add(message.messageId);
          }

          console.log(`[SignalR] ✅ Added message to chat (ID: ${message.messageId})`);

          this.shouldScrollToBottom = true;
          this.cdr.detectChanges();
          
          // Force change detection to ensure UI updates
          setTimeout(() => {
            this.cdr.detectChanges();
          }, 0);
        } else {
          console.log(`[SignalR] Ignoring message for different chat (received: ${chatId}, current: ${this.chatId})`);
        }
      },
      error: (error) => {
        console.error(`[SignalR] Error in message subscription:`, error);
      },
      complete: () => {
        console.log(`[SignalR] Message subscription completed`);
      }
    });

    // Subscribe to typing indicators
    this.signalRService.typing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ chatId, userId, isTyping }) => {
        if (chatId === this.chatId) {
          if (isTyping) {
            this.typingUsers.add(userId);
          } else {
            this.typingUsers.delete(userId);
          }
          this.cdr.detectChanges();
        }
      });

    // Subscribe to incoming calls
    this.signalRService.incomingCall$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ chatId, roomName, callType, callerId }) => {
        if (chatId === this.chatId) {
          const currentUser = this.authService.getCurrentUser();
          // Don't show modal if it's our own call
          if (currentUser && callerId !== currentUser.userId) {
            this.currentRoomName = roomName;
            this.currentCallType = callType;
            this.showCallModal = true;
            this.cdr.detectChanges();
          }
        }
      });

    // Subscribe to message updates (edit/delete) - use same pattern as new messages for consistency
    console.log(`[ChatWindow] Subscribing to messageUpdated$ observable...`);
    this.signalRService.messageUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ chatId, message }) => {
          if (chatId === this.chatId) {
            console.log(`[SignalR] Received MessageUpdated for message ${message.messageId} in chat ${chatId}`);
            console.log(`[SignalR] Updated message content: "${message.content?.substring(0, 50)}...", isEdited: ${message.isEdited}`);
            
            // Find the message by ID
            const existingIndex = this.messages.findIndex(m => m.messageId === message.messageId);
            
            if (existingIndex > -1) {
              // Found existing message - update it with SignalR data (same pattern as ReceiveMessage)
              const existingMessage = this.messages[existingIndex];
              
              // Always update with SignalR message data (it's the most up-to-date)
              // Create new array reference to trigger change detection (same as ReceiveMessage handler)
              this.messages = [
                ...this.messages.slice(0, existingIndex),
                { ...message }, // Use spread to create new object reference
                ...this.messages.slice(existingIndex + 1)
              ];
              
              console.log(`[SignalR] ✅ Updated existing message at index ${existingIndex} (ID: ${message.messageId})`);
              console.log(`[SignalR] Message content: "${message.content?.substring(0, 50)}..."`);
              console.log(`[SignalR] Message isEdited: ${message.isEdited}, editedAt: ${message.editedAt}`);
            } else {
              console.warn(`[SignalR] ⚠️ Message ${message.messageId} not found in messages array for update. Available message IDs:`, 
                this.messages.map(m => m.messageId).slice(0, 10));
              // Fallback: Reload messages if the message isn't found
              console.log(`[SignalR] Attempting to reload messages to find updated message ${message.messageId}`);
              this.reloadMessagesSilently();
              return;
            }
            
            // Force change detection immediately (same pattern as ReceiveMessage)
            this.cdr.detectChanges();
            
            // Force change detection again to ensure UI updates (same pattern as ReceiveMessage)
            setTimeout(() => {
              this.cdr.detectChanges();
            }, 0);
          } else {
            console.log(`[SignalR] Ignoring MessageUpdated for different chat (received: ${chatId}, current: ${this.chatId})`);
          }
        },
        error: (error) => {
          console.error(`[SignalR] Error in MessageUpdated subscription:`, error);
        },
        complete: () => {
          console.log(`[SignalR] MessageUpdated subscription completed`);
        }
      });
    console.log(`[ChatWindow] ✅ MessageUpdated subscription set up`);
  }

  loadChat(): void {
    this.chatService.getChatById(this.chatId).subscribe({
      next: (chat) => {
        this.chat = chat;
        this.loading = false;
        // Log participants for debugging
        if (chat.chatType === 'Group') {
          console.log(`[GroupChat] Loaded chat ${this.chatId} with ${chat.participants?.length || 0} participants:`, chat.participants);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading chat:', error);
        this.loading = false;
      }
    });
  }

  loadMessages(silent: boolean = false): void {
    // Only set loading if not silent (for initial load only)
    if (!silent && this.pageNumber === 1) {
      this.loading = true;
    }
    
    this.chatService.getChatMessages(this.chatId, this.pageNumber, 50).subscribe({
      next: (result) => {
        if (this.pageNumber === 1) {
          this.messages = result.items;
          // Reset processed message IDs when loading initial messages
          this.processedMessageIds.clear();
          // Track all loaded message IDs
          result.items.forEach(msg => {
            if (msg.messageId > 0) {
              this.processedMessageIds.add(msg.messageId);
            }
          });
          
          // Mark chat as read when opening it (only on initial load)
          if (!silent) {
            this.markChatAsRead();
          }
        } else {
          this.messages = [...result.items, ...this.messages];
          // Track loaded message IDs
          result.items.forEach(msg => {
            if (msg.messageId > 0) {
              this.processedMessageIds.add(msg.messageId);
            }
          });
        }
        this.hasMoreMessages = result.hasNextPage;
        this.loading = false;
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.loading = false;
        // Don't show error to user - messages will appear via polling fallback
      }
    });
  }
  
  private reloadMessagesSilently(): void {
    // Reload messages silently without showing any loader
    this.chatService.getChatMessages(this.chatId, 1, 50).subscribe({
      next: (result) => {
        if (result.items.length === 0) {
          return;
        }

        // If we have no messages, just set them (initial load)
        if (this.messages.length === 0) {
          this.messages = [...result.items];
          result.items.forEach(msg => {
            if (msg.messageId > 0) {
              this.processedMessageIds.add(msg.messageId);
            }
          });
          this.shouldScrollToBottom = true;
          this.cdr.detectChanges();
          return;
        }

        // Get current message IDs for comparison
        const currentMessageIds = new Set(this.messages.filter(m => m.messageId > 0).map(m => m.messageId));
        const currentUser = this.authService.getCurrentUser();
        
        // Process messages: replace optimistic or add as new
        let hasUpdates = false;
        const updatedMessages = [...this.messages];
        
        result.items.forEach(msg => {
          if (msg.messageId <= 0) return; // Skip invalid messages
          
          // Skip if already processed
          if (this.processedMessageIds.has(msg.messageId)) {
            return;
          }
          
          // Skip if message already exists with this ID
          if (currentMessageIds.has(msg.messageId)) {
            return;
          }
          
          // Check if this matches an optimistic message (for our own messages)
          const isMyMessage = currentUser && msg.senderId === currentUser.userId;
          if (isMyMessage) {
            const sentAtTime = new Date(msg.sentAt).getTime();
            const timeWindow = 10000; // 10 second window
            
            const optimisticIndex = updatedMessages.findIndex(m => {
              if (m.messageId >= 0) return false; // Only match optimistic (negative IDs)
              
              const mTime = new Date(m.sentAt).getTime();
              const timeDiff = Math.abs(sentAtTime - mTime);
              
              return m.content === msg.content &&
                     m.senderId === msg.senderId &&
                     timeDiff < timeWindow;
            });
            
            if (optimisticIndex > -1) {
              // Replace optimistic message
              updatedMessages[optimisticIndex] = msg;
              this.processedMessageIds.add(msg.messageId);
              hasUpdates = true;
              return;
            }
          }
          
          // Add as new message (for messages from other users)
          updatedMessages.push(msg);
          this.processedMessageIds.add(msg.messageId);
          hasUpdates = true;
        });
        
        if (hasUpdates) {
          // Sort messages by sentAt
          updatedMessages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
          this.messages = updatedMessages;
          
          // Scroll to bottom if we're at the bottom of the chat
          const container = this.messagesContainer?.nativeElement;
          if (container) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            if (isNearBottom) {
              this.shouldScrollToBottom = true;
            }
          } else {
            this.shouldScrollToBottom = true;
          }
          
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        // Silently fail - this is background polling
        console.debug('[SilentReload] Error:', error);
      }
    });
  }

  markChatAsRead(): void {
    this.chatService.markChatAsRead(this.chatId).subscribe({
      next: () => {
        // Update the chat's unread count locally
        if (this.chat) {
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            const participant = this.chat.participants.find(p => p.userId === currentUser.userId);
            if (participant) {
              participant.unreadCount = 0;
            }
          }
        }
      },
      error: (error) => {
        console.error('Error marking chat as read:', error);
        // Don't show error to user, just log it
      }
    });
  }

  loadMoreMessages(): void {
    if (this.hasMoreMessages && !this.loading) {
      this.pageNumber++;
      const oldestMessage = this.messages[0];
      if (oldestMessage) {
        const beforeDate = new Date(oldestMessage.sentAt);
        this.chatService.getChatMessages(this.chatId, this.pageNumber, 50, beforeDate).subscribe({
          next: (result) => {
            this.messages = [...result.items, ...this.messages];
            this.hasMoreMessages = result.hasNextPage;
          },
          error: (error) => {
            console.error('Error loading more messages:', error);
            this.pageNumber--;
          }
        });
      }
    }
  }

  sendMessage(): void {
    // If there's a selected file, upload it first
    if (this.selectedFile) {
      this.uploadAndSendFile();
      return;
    }

    if (!this.messageContent.trim()) {
      return;
    }

    const content = this.messageContent.trim();
    const request: SendMessageRequest = {
      content: content,
      messageType: 'Text'
    };

    // Clear input immediately for better UX
    this.messageContent = '';
    
    // Focus input immediately
    if (this.messageInput) {
      this.messageInput.nativeElement.focus();
    }

    // Send message - SignalR will deliver it and add to UI
    console.log(`[SendMessage] Sending message to chat ${this.chatId}: "${content.substring(0, 50)}..."`);
    console.log(`[SendMessage] SignalR connection state: ${this.signalRService.getConnectionState()}`);
    
    this.chatService.sendMessage(this.chatId, request).subscribe({
      next: (messageId) => {
        console.log(`[SendMessage] ✅ Message sent successfully, received messageId: ${messageId}`);
        console.log(`[SendMessage] Waiting for SignalR to deliver the message...`);
        // SignalR will receive and display the message
      },
      error: (error) => {
        console.error('Error sending message:', error);
        // Show error to user
        alert('Failed to send message. Please try again.');
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validate file size (25MB max)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        alert('File size exceeds the maximum allowed size of 25MB');
        input.value = '';
        return;
      }

      this.selectedFile = file;

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.filePreviewUrl = e.target?.result as string;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      } else {
        this.filePreviewUrl = null;
      }

      // Auto-send if there's no text content, or user can type a message and send
      this.cdr.detectChanges();
    }
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.filePreviewUrl = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.cdr.detectChanges();
  }

  triggerFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  uploadAndSendFile(): void {
    if (!this.selectedFile) {
      return;
    }

    this.uploadingFile = true;
    const currentUser = this.authService.getCurrentUser();
    // For images, only use user-typed content (don't auto-add filename)
    // For other files, use filename if no content provided
    const isImage = this.selectedFile.type.startsWith('image/');
    const content = this.messageContent.trim() || (isImage ? '' : this.selectedFile.name);

    // Create optimistic message
    const tempMessage: Message = {
      messageId: -Date.now(),
      chatId: this.chatId,
      senderId: currentUser?.userId || 0,
      senderName: currentUser?.fullName || currentUser?.username || 'You',
      senderRole: currentUser?.role,
      content: content,
      messageType: this.selectedFile.type.startsWith('image/') ? 'Image' : 'File',
      fileName: this.selectedFile.name,
      fileSize: this.selectedFile.size,
      sentAt: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
      fileUrl: this.selectedFile.type.startsWith('image/') ? (this.filePreviewUrl || undefined) : undefined // Use preview for images
    };

    // Track optimistic message
    const optimisticKey = `${content}_${currentUser?.userId}_${Date.now()}`;
    this.pendingOptimisticMessages.set(optimisticKey, tempMessage.messageId);

    // Add optimistic message immediately - create new array reference for change detection
    this.messages = [...this.messages, tempMessage];
    this.shouldScrollToBottom = true;
    this.cdr.detectChanges();

    // Upload file
    this.chatService.uploadMessageFile(this.selectedFile).subscribe({
      next: (uploadResponse) => {
        // File uploaded successfully - update optimistic message with fileUrl
        const optimisticIndex = this.messages.findIndex(m => m.messageId === tempMessage.messageId);
        if (optimisticIndex > -1) {
          this.messages[optimisticIndex] = {
            ...this.messages[optimisticIndex],
            fileUrl: uploadResponse.fileUrl,
            fileName: uploadResponse.fileName,
            fileSize: uploadResponse.fileSize,
            messageType: uploadResponse.messageType
          };
          this.cdr.detectChanges();
        }

        // Now send the message
        const request: SendMessageRequest = {
          content: content,
          messageType: uploadResponse.messageType,
          fileUrl: uploadResponse.fileUrl,
          fileName: uploadResponse.fileName,
          fileSize: uploadResponse.fileSize
        };

        this.chatService.sendMessage(this.chatId, request).subscribe({
          next: (messageId) => {
            // Message sent successfully - SignalR will update the optimistic message
            // Don't update here to avoid duplicates
            console.log(`[SendFile] Message sent successfully, messageId: ${messageId}`);
            console.log(`[SendFile] SignalR will update the optimistic message with real data`);

            // Clear form and reset state
            this.selectedFile = null;
            this.filePreviewUrl = null;
            this.messageContent = '';
            this.uploadingFile = false;
            if (this.fileInput) {
              this.fileInput.nativeElement.value = '';
            }

            this.shouldScrollToBottom = true;
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error sending message with file:', error);
            this.uploadingFile = false;
            // Remove optimistic message on error - create new array reference
            const index = this.messages.findIndex(m => m.messageId === tempMessage.messageId);
            if (index > -1) {
              this.messages = [
                ...this.messages.slice(0, index),
                ...this.messages.slice(index + 1)
              ];
              this.cdr.detectChanges();
            }
            alert('Failed to send file. Please try again.');
          }
        });
      },
      error: (error) => {
        console.error('Error uploading file:', error);
        this.uploadingFile = false;
        // Remove optimistic message on error - create new array reference
        const index = this.messages.findIndex(m => m.messageId === tempMessage.messageId);
        if (index > -1) {
          this.messages = [
            ...this.messages.slice(0, index),
            ...this.messages.slice(index + 1)
          ];
          this.cdr.detectChanges();
        }
        alert('Failed to upload file. Please try again.');
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getImageUrl(message: Message): string {
    if (message.messageId) {
      // Check if we already have a blob URL for this image
      const blobUrl = this.imageBlobUrls.get(message.messageId);
      if (blobUrl) {
        return blobUrl;
      }

      // Load the image with authentication and create blob URL
      this.loadImageBlob(message.messageId);
      return ''; // Return empty while loading
    }

    // For optimistic messages without ID, try fileUrl first, then fallback to preview
    if (message.fileUrl) {
      return message.fileUrl;
    }

    // For image messages without fileUrl, check if this matches the current selectedFile preview
    if (message.messageType === 'Image' && message.fileName === this.selectedFile?.name) {
      return this.filePreviewUrl || '';
    }

    return '';
  }

  private loadImageBlob(messageId: number): void {
    // Avoid duplicate requests
    if (this.imageBlobUrls.has(messageId)) {
      return;
    }

    // Use the authenticated view URL directly for blob creation
    const viewUrl = this.chatService.viewMessageFile(messageId);
    const token = this.authService.getToken();

    if (token) {
      fetch(viewUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load image');
        }
        return response.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        this.imageBlobUrls.set(messageId, blobUrl);
        this.cdr.detectChanges(); // Trigger re-render with blob URL
      })
      .catch(error => {
        console.error(`Failed to load image blob for message ${messageId}:`, error);
        this.imageLoadErrors.add(messageId);
        this.cdr.detectChanges();
      });
    } else {
      // Fallback if no token
      this.imageLoadErrors.add(messageId);
      this.cdr.detectChanges();
    }
  }

  onImageError(event: Event, message: Message): void {
    if (message.messageId) {
      this.imageLoadErrors.add(message.messageId);
      console.warn(`Failed to load image for message ${message.messageId}:`, event);
    }
  }

  retryImageLoad(message: Message): void {
    if (message.messageId) {
      this.imageLoadErrors.delete(message.messageId);
      // Clean up existing blob URL if any
      const existingBlobUrl = this.imageBlobUrls.get(message.messageId);
      if (existingBlobUrl) {
        URL.revokeObjectURL(existingBlobUrl);
        this.imageBlobUrls.delete(message.messageId);
      }
      // Try to load the image again
      this.loadImageBlob(message.messageId);
    }
  }

  viewImage(message: Message): void {
    if (message.messageId) {
      this.selectedImageMessage = message;
      this.showImageModal = true;
      // Load the full-size image blob if not already loaded
      if (!this.imageBlobUrls.has(message.messageId)) {
        this.loadImageBlob(message.messageId);
      }
    }
  }

  closeImageModal(): void {
    this.showImageModal = false;
    this.selectedImageMessage = null;
  }

  // Voice Recording Functions
  async toggleVoiceRecording(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording(): Promise<void> {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        // Create audio blob
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.recordedAudio = audioBlob;
        this.audioUrl = URL.createObjectURL(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.recordingTime = 0;

      // Start timer
      this.recordingInterval = setInterval(() => {
        this.recordingTime++;
        this.cdr.detectChanges();
      }, 1000);

      console.log('Voice recording started');

    } catch (error) {
      console.error('Error starting voice recording:', error);
      alert('Microphone access is required for voice recording. Please check your microphone permissions.');
    }
  }

  async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      clearInterval(this.recordingInterval);
      console.log('Voice recording stopped');
    }
  }

  cancelRecording(): void {
    this.stopRecording();
    this.recordedAudio = null;
    this.audioUrl = null;
    this.recordingTime = 0;
    console.log('Voice recording cancelled');
  }

  discardRecording(): void {
    this.recordedAudio = null;
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
    this.recordingTime = 0;
    console.log('Voice recording discarded');
  }

  async sendVoiceMessage(): Promise<void> {
    if (this.recordedAudio) {
      // Convert blob to file
      const audioFile = new File([this.recordedAudio], `voice_${Date.now()}.webm`, {
        type: 'audio/webm'
      });

      // Set as selected file and use existing file upload logic
      this.selectedFile = audioFile;
      await this.uploadAndSendFile();

      // Clean up
      this.recordedAudio = null;
      if (this.audioUrl) {
        URL.revokeObjectURL(this.audioUrl);
        this.audioUrl = null;
      }
      this.recordingTime = 0;
    }
  }

  playRecordedAudio(): void {
    // This could be enhanced to show a proper audio player
    if (this.audioUrl) {
      const audio = new Audio(this.audioUrl);
      audio.play();
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  downloadFile(message: Message): void {
    if (message.messageId) {
      // Use the authenticated download endpoint
      const downloadUrl = this.chatService.downloadMessageFile(message.messageId);

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.download = message.fileName || `message_file_${message.messageId}`;

      // Add authorization header via fetch if needed, or use the API service
      const token = this.authService.getToken();

      if (token) {
        fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to download file');
          }
          return response.blob();
        })
        .then(blob => {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = message.fileName || `message_file_${message.messageId}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        })
        .catch(error => {
          console.error('Error downloading message file:', error);
          alert('Failed to download file. Please try again.');
        });
      } else {
        // Fallback to direct link (will fail if auth required)
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }

  onTyping(): void {
    this.signalRService.sendTypingIndicator(this.chatId, true);

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.signalRService.sendTypingIndicator(this.chatId, false);
    }, 1000);
  }

  startCall(callType: string = 'Video'): void {
    this.chatService.createJitsiRoom({ chatId: this.chatId, callType }).subscribe({
      next: (roomInfo) => {
        this.currentRoomName = roomInfo.roomName;
        this.currentCallType = callType;
        this.isInCall = true;
        this.initializeJitsi(roomInfo.roomName, callType);
        this.signalRService.createJitsiRoom(this.chatId, roomInfo.roomName, callType);
      },
      error: (error) => {
        console.error('Error creating call:', error);
        alert('Failed to start call. Please try again.');
      }
    });
  }

  acceptCall(): void {
    if (this.currentRoomName) {
      this.isInCall = true;
      this.showCallModal = false;
      this.initializeJitsi(this.currentRoomName, this.currentCallType);
      this.signalRService.joinJitsiRoom(this.chatId, this.currentRoomName);
      this.cdr.detectChanges();
    }
  }

  rejectCall(): void {
    this.showCallModal = false;
    this.currentRoomName = null;
  }

  endCall(): void {
    this.jitsiService.hangup();
    this.jitsiService.dispose();
    this.isInCall = false;
    if (this.currentRoomName) {
      this.signalRService.leaveJitsiRoom(this.chatId, this.currentRoomName);
      this.currentRoomName = null;
    }
    this.currentCallType = 'Video';
    this.cdr.detectChanges();
  }

  private async initializeJitsi(roomName: string, callType: string = 'Video'): Promise<void> {
    const jitsiContainer = document.getElementById('jitsi-container');
    if (!jitsiContainer) {
      console.error('Jitsi container not found');
      return;
    }

    const isVoiceCall = callType === 'Voice' || callType === 'voice';

    // Request microphone permission explicitly before initializing Jitsi
    try {
      console.log('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVoiceCall ? false : true
      });
      console.log('Microphone permission granted, stream:', stream);
      // Stop the stream as Jitsi will create its own
      stream.getTracks().forEach(track => track.stop());
    } catch (error: any) {
      console.error('Error requesting microphone permission:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Microphone permission is required for voice calls. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Error accessing microphone: ' + error.message);
      }
      return;
    }

    // Configure Jitsi based on call type
    const configOverwrite: any = {
      startWithAudioMuted: false, // Audio enabled - this is critical
      startWithVideoMuted: isVoiceCall, // Mute video for voice calls
      defaultLanguage: 'en',
      // Ensure audio is prioritized for voice calls
      disableAudioLevels: false,
      enableNoAudioDetection: true,
      enableNoisyMicDetection: true,
      // Audio settings
      audioQuality: {
        opusMaxAverageBitrate: 64000, // Good quality for voice
        stereo: false
      },
      // Force audio to be enabled
      constraints: {
        video: !isVoiceCall,
        audio: true
      }
    };

    // For voice calls, hide video-related UI elements
    const interfaceConfigOverwrite: any = {
      TOOLBAR_BUTTONS: [
        'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
        'fodeviceselection', 'hangup', 'chat', 'settings', 'videoquality', 'filmstrip',
        'invite', 'feedback', 'stats', 'shortcuts', 'tileview', 'download', 'help', 'mute-everyone'
      ],
      SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile']
    };

    // For voice calls, disable camera button and video-related features
    if (isVoiceCall) {
      interfaceConfigOverwrite.TOOLBAR_BUTTONS = [
        'microphone', 'fodeviceselection', 'hangup', 'chat', 'settings', 'invite', 'feedback', 'help', 'mute-everyone'
      ];
      interfaceConfigOverwrite.HIDE_INVITE_MORE_HEADER = false;
    }

    this.jitsiService.initializeJitsi({
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainer,
      configOverwrite: configOverwrite,
      interfaceConfigOverwrite: interfaceConfigOverwrite
    });

    // Subscribe to conference left event
    this.jitsiService.videoConferenceLeft$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.endCall();
      });

    // Wait for conference to join, then ensure proper configuration
    this.jitsiService.videoConferenceJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        console.log('Joined conference:', event, 'Call type:', callType);
        setTimeout(() => {
          const api = this.jitsiService.getApi();
          if (api) {
            try {
              // For voice calls, ensure video is off
              if (isVoiceCall) {
                api.executeCommand('toggleVideo');
                console.log('Voice call: Video disabled');
              }

              // Listen for audio status changes and ensure it stays enabled
              api.addEventListener('audioMuteStatusChanged', (event: any) => {
                console.log('Audio mute status changed:', event);
                if (event.muted) {
                  console.warn('⚠️ Audio was muted! Attempting to unmute...');
                  setTimeout(() => {
                    try {
                      api.executeCommand('toggleAudio');
                      console.log('✅ Audio unmuted');
                    } catch (error) {
                      console.error('Failed to unmute audio:', error);
                    }
                  }, 500);
                } else {
                  console.log('✅ Audio is enabled');
                }
              });

              // For voice calls, ensure video stays off
              if (isVoiceCall) {
                api.addEventListener('videoMuteStatusChanged', (event: any) => {
                  if (!event.muted) {
                    console.log('Video was enabled in voice call, disabling...');
                    api.executeCommand('toggleVideo');
                  }
                });
              }

              console.log('Call configuration complete. Audio should be enabled.');

              console.log('Call configured successfully');
            } catch (error) {
              console.error('Error configuring call:', error);
            }
          }
        }, 2000); // Wait for Jitsi to fully initialize
      });
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  isMyMessage(message: Message): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser ? message.senderId === currentUser.userId : false;
  }

  getTypingText(): string {
    if (this.typingUsers.size === 0) return '';
    if (this.typingUsers.size === 1) return 'Someone is typing...';
    return `${this.typingUsers.size} people are typing...`;
  }

  getChatDisplayName(): string {
    if (!this.chat) return '';
    if (this.chat.chatType === 'Group') {
      return this.chat.groupName || 'Group Chat';
    }
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const otherParticipant = this.chat.participants.find(p => p.userId !== currentUser.userId);
      return otherParticipant?.fullName || otherParticipant?.userName || 'Unknown User';
    }
    return 'Chat';
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getRoleColor(role?: string): string {
    if (!role) return '#6c757d';
    const roleColors: { [key: string]: string } = {
      'Admin': '#dc3545',
      'Dispatcher': '#0d6efd',
      'Driver': '#198754',
      'Accountant': '#ffc107',
      'FleetManager': '#fd7e14'
    };
    return roleColors[role] || '#6c757d';
  }

  formatMessageTime(dateString: string): string {
    return this.timeZoneService.formatTime(dateString);
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
    this.cdr.detectChanges();
  }

  insertEmoji(emoji: string): void {
    this.messageContent += emoji;
    this.showEmojiPicker = false;
    this.cdr.detectChanges();
  }

  commonEmojis: string[] = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
    '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '✋🏻', '🤚🏻', '👍🏻', '👎🏻', '🙏🏻', '👏🏻', '👊🏻', '🤛🏻',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
    '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
    '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
    '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
    '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
    '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
    '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
    '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
    '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
    '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🔥',
    '🤜🏻', '🤘🏻', '🤙🏻', '👌🏻', '👈🏻', '👉🏻', '👆🏻', '👇🏻',
    '👋🏻', '🤞🏻', '🖖🏻', '🤟🏻', '🤘🏻', '🤙🏻', '👌🏻', '👈🏻',
    '👉🏻', '👆🏻', '👇🏻', '👋🏻', '🤞🏻', '🖖🏻', '🤟🏻', '📞'
  ];

  trackByMessageId(index: number, message: Message): number {
    // Use messageId as the trackBy key, and include content and isEdited to force update when these change
    return message.messageId || index;
  }

  isNewDay(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getDate() !== d2.getDate() || 
           d1.getMonth() !== d2.getMonth() || 
           d1.getFullYear() !== d2.getFullYear();
  }

  isSameSender(message1: Message, message2: Message): boolean {
    return message1.senderId === message2.senderId;
  }

  formatDateSeparator(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return this.datePipe.transform(date, 'MMMM d, y') || '';
    }
  }

  getFileIcon(fileName?: string): string {
    if (!fileName) return 'fa-file';
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'pdf': 'fa-file-pdf',
      'doc': 'fa-file-word',
      'docx': 'fa-file-word',
      'xls': 'fa-file-excel',
      'xlsx': 'fa-file-excel',
      'ppt': 'fa-file-powerpoint',
      'pptx': 'fa-file-powerpoint',
      'txt': 'fa-file-alt',
      'csv': 'fa-file-csv',
      'zip': 'fa-file-archive',
      'rar': 'fa-file-archive',
      '7z': 'fa-file-archive',
      'mp4': 'fa-file-video',
      'avi': 'fa-file-video',
      'mov': 'fa-file-video',
      'mp3': 'fa-file-audio',
      'wav': 'fa-file-audio',
      'jpg': 'fa-file-image',
      'jpeg': 'fa-file-image',
      'png': 'fa-file-image',
      'gif': 'fa-file-image'
    };
    
    return iconMap[extension || ''] || 'fa-file';
  }

  // Group members management
  toggleMembersPanel(): void {
    this.showMembersPanel = !this.showMembersPanel;
    if (this.showMembersPanel && this.chat?.chatType === 'Group') {
      // Refresh chat to get latest participants
      this.loadChat();
    }
  }

  isGroupAdmin(): boolean {
    if (!this.chat || this.chat.chatType !== 'Group') {
      return false;
    }
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }
    const participant = this.chat.participants.find(p => p.userId === currentUser.userId);
    return participant?.role === 'Admin';
  }

  searchUsersForGroup(): void {
    if (!this.memberSearchTerm.trim()) {
      this.availableUsers = [];
      return;
    }

    this.chatService.getMessagingUsers().subscribe({
      next: (users) => {
        const term = this.memberSearchTerm.toLowerCase();
        this.availableUsers = users.filter(u => 
          (u.fullName?.toLowerCase().includes(term)) ||
          (u.username?.toLowerCase().includes(term)) ||
          (u.email?.toLowerCase().includes(term))
        );
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.availableUsers = [];
      }
    });
  }

  isUserAlreadyMember(userId: number): boolean {
    if (!this.chat?.participants) {
      return false;
    }
    return this.chat.participants.some(p => p.userId === userId);
  }

  addMemberToGroup(userId: number): void {
    if (this.isUserAlreadyMember(userId)) {
      return; // Already a member
    }

    this.chatService.addGroupMember(this.chatId, userId).subscribe({
      next: () => {
        console.log(`[GroupChat] Successfully added member ${userId} to group ${this.chatId}`);
        // Refresh chat to get updated participants list
        this.loadChat();
        // Clear search
        this.memberSearchTerm = '';
        this.availableUsers = [];
        // Close modal after a short delay to show success
        setTimeout(() => {
          this.showAddMemberModal = false;
          // Ensure members panel is visible to show the new member
          if (!this.showMembersPanel) {
            this.showMembersPanel = true;
          }
        }, 500);
      },
      error: (error) => {
        console.error('Error adding member to group:', error);
        const errorMessage = error?.error?.message || error?.message || 'Failed to add member. Please try again.';
        alert(`Failed to add member: ${errorMessage}`);
      }
    });
  }

  leaveGroup(): void {
    if (!this.chat || this.chat.chatType !== 'Group') {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('You must be signed in to leave the group.');
      return;
    }

    if (!confirm('Leave this group? You will stop receiving new messages.')) {
      return;
    }

    this.leavingGroup = true;

    this.chatService.removeGroupMember(this.chatId, currentUser.userId).subscribe({
      next: () => {
        // Clean up realtime connections and navigate back to chat list
        this.signalRService.leaveChat(this.chatId);
        this.stopMessagePolling();
        this.leavingGroup = false;
        this.router.navigate(['/messaging']);
      },
      error: (error) => {
        console.error('Error leaving group:', error);
        const message = error?.error?.message || error?.message || 'Failed to leave the group. Please try again.';
        alert(message);
        this.leavingGroup = false;
      }
    });
  }
}

