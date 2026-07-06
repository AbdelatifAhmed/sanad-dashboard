import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs';

import {
  AdminMessagesService,
  AdminConversation,
  AdminMessage,
  ConversationFilter,
} from '../../core/services/admin-messages.service';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { TruncatePipe } from '../../shared/pipes/truncate.pipe';

@Component({
  selector: 'app-messages',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, TimeAgoPipe, TruncatePipe],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageTextarea') messageTextarea!: ElementRef<HTMLTextAreaElement>;

  private readonly msgsService = inject(AdminMessagesService);
  private readonly socket      = inject(SocketService);
  private readonly auth        = inject(AuthService);
  private readonly toast       = inject(ToastService);
  private readonly cdr         = inject(ChangeDetectorRef);
  private readonly route       = inject(ActivatedRoute);

  // ── State ──────────────────────────────────────────────────────────────────
  conversations  = signal<AdminConversation[]>([]);
  messages       = signal<AdminMessage[]>([]);
  selectedConv   = signal<AdminConversation | null>(null);
  activeFilter   = signal<ConversationFilter>('all');
  searchQuery    = signal('');
  newMessage     = signal('');
  typingLabel    = signal('');

  loadingConvs   = signal(true);
  loadingMsgs    = signal(false);
  sendingMsg     = signal(false);
  uploadingFile  = signal(false);
  showInfoPanel  = signal(false);

  onlineUsers    = signal<Set<string>>(new Set());

  // Pagination
  private   msgPage     = 1;
  protected hasMoreMsgs = false;
  private   totalConvs  = 0;

  private readonly destroy$   = new Subject<void>();
  private readonly search$    = new Subject<string>();
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private previousConvId: string | null = null;

  readonly filters: { key: ConversationFilter; label: string; icon: string }[] = [
    { key: 'all',        label: 'All',        icon: 'forum'           },
    { key: 'families',   label: 'Families',   icon: 'family_restroom' },
    { key: 'caregivers', label: 'Caregivers', icon: 'medical_services'},
    { key: 'unread',     label: 'Unread',     icon: 'mark_chat_unread'},
    { key: 'open',       label: 'Open',       icon: 'chat_bubble'     },
    { key: 'resolved',   label: 'Resolved',   icon: 'check_circle'    },
  ];

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  readonly visibleMessages = computed(() =>
    this.messages().filter((m) => !m.isDeleted)
  );

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0)
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadConversations();
    this.subscribeSearch();
    this.connectSocket();

    // Support deep-linking: /messages?open=<conversationId>
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const openId = params['open'];
      if (openId) this.openConversationById(openId);
    });
  }

  ngOnDestroy(): void {
    if (this.previousConvId) this.socket.leaveRoom(this.previousConvId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Conversations ──────────────────────────────────────────────────────────
  loadConversations(): void {
    this.loadingConvs.set(true);
    this.msgsService
      .getConversations(this.activeFilter(), this.searchQuery())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.loadingConvs.set(false); this.cdr.markForCheck(); })
      )
      .subscribe({
        next: (res) => {
          this.conversations.set(res.data.conversations);
          this.totalConvs = res.data.total;
        },
        error: () => this.toast.error('Failed to load conversations'),
      });
  }

  setFilter(f: ConversationFilter): void {
    if (this.activeFilter() === f) return;
    this.activeFilter.set(f);
    this.loadConversations();
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.search$.next(val);
  }

  private subscribeSearch(): void {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadConversations());
  }

  // ── Chat History ──────────────────────────────────────────────────────────
  selectConversation(conv: AdminConversation): void {
    if (this.selectedConv()?._id === conv._id) return;

    // Leave previous room
    if (this.previousConvId) this.socket.leaveRoom(this.previousConvId);

    this.selectedConv.set(conv);
    this.messages.set([]);
    this.msgPage = 1;
    this.hasMoreMsgs = false;
    this.typingLabel.set('');

    this.loadMessages(conv._id);

    // Join new room
    this.socket.joinRoom(conv._id);
    this.previousConvId = conv._id;

    // Mark as read
    if (conv.unreadByAdmin > 0) this.markAsRead(conv._id);
  }

  private loadMessages(convId: string, prepend = false): void {
    this.loadingMsgs.set(true);
    this.msgsService
      .getChatHistory(convId, this.msgPage)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.loadingMsgs.set(false); this.cdr.markForCheck(); })
      )
      .subscribe({
        next: (res) => {
          const newMsgs = res.data.messages;
          if (prepend) {
            this.messages.update((prev) => [...newMsgs, ...prev]);
          } else {
            this.messages.set(newMsgs);
            setTimeout(() => this.scrollToBottom(), 100);
          }
          this.hasMoreMsgs = res.data.messages.length >= 50;
          // Sync conversation with server data (to get user info if not loaded)
          this.selectedConv.set(res.data.conversation);
        },
        error: () => this.toast.error('Failed to load messages'),
      });
  }

  loadMoreMessages(): void {
    const conv = this.selectedConv();
    if (!conv || !this.hasMoreMsgs || this.loadingMsgs()) return;
    this.msgPage++;
    this.loadMessages(conv._id, true);
  }

  // ── Sending ────────────────────────────────────────────────────────────────
  sendMessage(): void {
    const text = this.newMessage().trim();
    const conv = this.selectedConv();
    if (!text || !conv || this.sendingMsg()) return;

    this.sendingMsg.set(true);
    this.socket.sendStopTyping(conv._id);

    this.msgsService
      .sendMessage({ conversationId: conv._id, text })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.sendingMsg.set(false); this.cdr.markForCheck(); })
      )
      .subscribe({
        next: (res) => {
          this.newMessage.set('');
          this.appendMessage(res.data.message);
          this.updateConvLastMessage(conv._id, text);
        },
        error: () => this.toast.error('Failed to send message'),
      });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInputChange(val: string): void {
    this.newMessage.set(val);
    const conv = this.selectedConv();
    if (!conv) return;

    this.socket.sendTyping({
      conversationId: conv._id,
      senderRole: 'admin',
      senderName: this.auth.currentUser()?.name || 'Admin',
    });

    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.socket.sendStopTyping(conv._id), 2500);
  }

  // ── File Upload ────────────────────────────────────────────────────────────
  triggerFileUpload(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const conv = this.selectedConv();
    if (!file || !conv) return;

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      this.toast.error('File exceeds the 5 MB limit');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      this.toast.error('Only JPEG, PNG and PDF files are supported');
      return;
    }

    this.uploadingFile.set(true);
    this.msgsService
      .uploadAttachment(conv._id, file)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.uploadingFile.set(false); this.cdr.markForCheck(); })
      )
      .subscribe({
        next: (res) => {
          this.appendMessage(res.data.message);
          this.updateConvLastMessage(conv._id, res.data.message.text);
          input.value = '';
        },
        error: () => this.toast.error('Upload failed'),
      });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  resolveConversation(): void {
    const conv = this.selectedConv();
    if (!conv) return;
    this.msgsService.resolveConversation(conv._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.selectedConv.update((c) => c ? { ...c, status: 'resolved' } : c);
        this.updateConvStatus(conv._id, 'resolved');
        this.toast.success('Conversation resolved');
      },
      error: () => this.toast.error('Failed to resolve conversation'),
    });
  }

  reopenConversation(): void {
    const conv = this.selectedConv();
    if (!conv) return;
    this.msgsService.reopenConversation(conv._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.selectedConv.update((c) => c ? { ...c, status: 'open' } : c);
        this.updateConvStatus(conv._id, 'open');
        this.toast.success('Conversation reopened');
      },
      error: () => this.toast.error('Failed to reopen conversation'),
    });
  }

  deleteMessage(msgId: string): void {
    this.msgsService.deleteMessage(msgId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.messages.update((msgs) =>
          msgs.map((m) => (m._id === msgId ? { ...m, isDeleted: true, text: '' } : m))
        );
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Failed to delete message'),
    });
  }

  private markAsRead(convId: string): void {
    this.msgsService.markAsRead(convId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.conversations.update((list) =>
          list.map((c) => (c._id === convId ? { ...c, unreadByAdmin: 0 } : c))
        );
      },
    });
  }

  // ── Socket ─────────────────────────────────────────────────────────────────
  private connectSocket(): void {
    this.socket.connect();

    // New message in active conversation
    this.socket.on('adminMessage:new', (msg: AdminMessage) => {
      if (msg.conversationId === this.selectedConv()?._id) {
        this.appendMessage(msg);
        // Auto mark as read if we're the receiver
        if (
          typeof msg.receiverId === 'string'
            ? msg.receiverId === this.currentUserId()
            : (msg.receiverId as any)?._id === this.currentUserId()
        ) {
          this.markAsRead(msg.conversationId);
        }
      }
      this.patchConversationFromMessage(msg);
      this.cdr.markForCheck();
    });

    // Typing
    this.socket.on('adminMessage:typing', (payload: any) => {
      if (payload.conversationId === this.selectedConv()?._id) {
        const role = payload.senderRole;
        const name = payload.senderName || role;
        this.typingLabel.set(`${name} is typing...`);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('adminMessage:stopTyping', (payload: any) => {
      if (payload.conversationId === this.selectedConv()?._id) {
        this.typingLabel.set('');
        this.cdr.markForCheck();
      }
    });

    // Read receipts
    this.socket.on('adminMessage:read', (payload: any) => {
      this.messages.update((msgs) =>
        msgs.map((m) => ({ ...m, isRead: true }))
      );
      this.cdr.markForCheck();
    });

    // Conversation status changes
    this.socket.on('adminConversation:resolved', ({ conversationId }: any) => {
      this.updateConvStatus(conversationId, 'resolved');
      if (this.selectedConv()?._id === conversationId) {
        this.selectedConv.update((c) => c ? { ...c, status: 'resolved' } : c);
      }
      this.cdr.markForCheck();
    });

    this.socket.on('adminConversation:reopened', ({ conversationId }: any) => {
      this.updateConvStatus(conversationId, 'open');
      if (this.selectedConv()?._id === conversationId) {
        this.selectedConv.update((c) => c ? { ...c, status: 'open' } : c);
      }
      this.cdr.markForCheck();
    });

    // Soft delete
    this.socket.on('adminMessage:deleted', ({ messageId }: any) => {
      this.messages.update((msgs) =>
        msgs.map((m) => (m._id === messageId ? { ...m, isDeleted: true, text: '' } : m))
      );
      this.cdr.markForCheck();
    });

    // Online presence
    this.socket.on('adminPresence:userOnline', ({ userId }: any) => {
      this.onlineUsers.update((s) => { const n = new Set(s); n.add(userId); return n; });
      this.cdr.markForCheck();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private appendMessage(msg: AdminMessage): void {
    this.messages.update((prev) => {
      const exists = prev.some((m) => m._id === msg._id);
      return exists ? prev : [...prev, msg];
    });
    setTimeout(() => this.scrollToBottom(), 50);
    this.cdr.markForCheck();
  }

  private updateConvLastMessage(convId: string, text: string): void {
    this.conversations.update((list) =>
      list.map((c) =>
        c._id === convId ? { ...c, lastMessage: text, lastMessageTime: new Date().toISOString() } : c
      )
    );
  }

  private updateConvStatus(convId: string, status: 'open' | 'resolved'): void {
    this.conversations.update((list) =>
      list.map((c) => (c._id === convId ? { ...c, status } : c))
    );
  }

  private patchConversationFromMessage(msg: AdminMessage): void {
    const convId = msg.conversationId;
    this.conversations.update((list) => {
      const idx = list.findIndex((c) => c._id === convId);
      if (idx === -1) {
        // New conversation — reload list
        this.loadConversations();
        return list;
      }
      const updated = [...list];
      const isAdminReceiver = msg.receiverRole === 'admin';
      updated[idx] = {
        ...updated[idx],
        lastMessage: msg.isDeleted ? '' : msg.text,
        lastMessageTime: msg.createdAt,
        unreadByAdmin: isAdminReceiver
          ? (updated[idx].unreadByAdmin || 0) + (this.selectedConv()?._id === convId ? 0 : 1)
          : updated[idx].unreadByAdmin,
      };
      return updated;
    });
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch (_) {}
  }

  /** Open a conversation by its ID — called via query param or direct reference */
  openConversationById(convId: string): void {
    // If already in the list, select it directly
    const existing = this.conversations().find((c) => c._id === convId);
    if (existing) {
      this.selectConversation(existing);
      return;
    }
    // Otherwise load its history (admin navigated here before list loaded)
    this.msgsService.getChatHistory(convId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const conv = res.data.conversation;
        // Prepend to list if not present
        this.conversations.update((list) => {
          const alreadyIn = list.some((c) => c._id === conv._id);
          return alreadyIn ? list : [conv, ...list];
        });
        this.selectConversation(conv);
      },
      error: () => this.toast.error('Could not open conversation'),
    });
  }

  // ── Template helpers ───────────────────────────────────────────────────────
  isOnline(userId: string): boolean {
    return this.onlineUsers().has(userId);
  }

  getSenderName(msg: AdminMessage): string {
    const s = msg.senderId;
    return typeof s === 'string' ? '' : (s as any).name || '';
  }

  getSenderAvatar(msg: AdminMessage): string {
    const s = msg.senderId;
    if (typeof s === 'string') return '';
    return (s as any).avatar?.url || '';
  }

  isOwnMessage(msg: AdminMessage): boolean {
    const sId = typeof msg.senderId === 'string' ? msg.senderId : (msg.senderId as any)?._id;
    return sId === this.currentUserId();
  }

  getRoleBadgeClass(role: string): string {
    return role === 'family' ? 'badge-family' : 'badge-caregiver';
  }

  getRoleLabel(role: string): string {
    return role === 'family' ? 'Family' : 'Caregiver';
  }

  trackByConv(_: number, c: AdminConversation): string { return c._id; }
  trackByMsg(_: number, m: AdminMessage): string { return m._id; }

  getAvatarUrl(user: any): string {
    return user?.avatar?.url || '';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name[0].toUpperCase();
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
