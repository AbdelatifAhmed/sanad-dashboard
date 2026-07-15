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
  ConversationStatus,
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

  // Presence: map of userId → { isOnline, lastSeen }
  presenceMap    = signal<Record<string, { isOnline: boolean; lastSeen: string | null }>>({});

  // Pagination
  private   msgPage     = 1;
  protected hasMoreMsgs = false;
  private   totalConvs  = 0;

  private readonly destroy$   = new Subject<void>();
  private readonly search$    = new Subject<string>();
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private previousConvId: string | null = null;

  readonly filters: { key: ConversationFilter; label: string; icon: string }[] = [
    { key: 'all',               label: 'All',              icon: 'forum'             },
    { key: 'families',          label: 'Families',         icon: 'family_restroom'   },
    { key: 'caregivers',        label: 'Caregivers',       icon: 'medical_services'  },
    { key: 'unread',            label: 'Unread',           icon: 'mark_chat_unread'  },
    { key: 'open',              label: 'Open',             icon: 'chat_bubble'       },
    { key: 'waiting_for_admin', label: 'Needs Reply',      icon: 'pending'           },
    { key: 'resolved',          label: 'Resolved',         icon: 'check_circle'      },
    { key: 'closed',            label: 'Closed',           icon: 'lock'              },
  ];

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  readonly visibleMessages = computed(() =>
    this.messages().filter((m) => !m.isDeleted || m.messageType === 'system')
  );

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0)
  );

  readonly isConvResolved = computed(() => this.selectedConv()?.status === 'resolved');
  readonly isConvClosed   = computed(() => this.selectedConv()?.status === 'closed');
  readonly isConvLocked   = computed(() =>
    ['resolved', 'closed'].includes(this.selectedConv()?.status ?? '')
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadConversations();
    this.subscribeSearch();
    this.connectSocket();

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

          // Seed presence map from loaded users
          const map: Record<string, { isOnline: boolean; lastSeen: string | null }> = { ...this.presenceMap() };
          res.data.conversations.forEach((c) => {
            if (c.user) map[c.userId] = { isOnline: c.user.isOnline ?? false, lastSeen: c.user.lastSeen ?? null };
          });
          this.presenceMap.set(map);

          // Keep selectedConv in sync with the freshly loaded data
          const sel = this.selectedConv();
          if (sel) {
            const fresh = res.data.conversations.find((c) => c._id === sel._id);
            if (fresh) this.selectedConv.set(fresh);
          }
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
    if (this.previousConvId) this.socket.leaveRoom(this.previousConvId);

    this.selectedConv.set(conv);
    this.messages.set([]);
    this.msgPage = 1;
    this.hasMoreMsgs = false;
    this.typingLabel.set('');

    this.loadMessages(conv._id);
    this.socket.joinRoom(conv._id);
    this.previousConvId = conv._id;

    // Immediately clear unread — don't wait for the API response
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
          this.selectedConv.set(res.data.conversation);
          // Seed presence for this user
          if (res.data.conversation.user) {
            this.patchPresence(res.data.conversation.userId, {
              isOnline: res.data.conversation.user.isOnline ?? false,
              lastSeen: res.data.conversation.user.lastSeen ?? null,
            });
          }
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
    this.newMessage.set('');           // clear input immediately (optimistic)
    this.socket.sendStopTyping(conv._id);

    this.msgsService
      .sendMessage({ conversationId: conv._id, text })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.sendingMsg.set(false); this.cdr.markForCheck(); })
      )
      .subscribe({
        next: (res) => {
          this.appendMessage(res.data.message);
          // Optimistic: update preview + status + move to top immediately
          this.applyConvPatch(conv._id, {
            lastMessage: text,
            lastMessageTime: new Date().toISOString(),
            status: 'waiting_for_user',
          });
          this.selectedConv.update((c) =>
            c ? { ...c, status: 'waiting_for_user', lastMessage: text, lastMessageTime: new Date().toISOString() } : c
          );
        },
        error: () => {
          // Restore the text so the user doesn't lose their message
          this.newMessage.set(text);
          this.toast.error('Failed to send message');
        },
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

    if (file.size > 5 * 1024 * 1024) { this.toast.error('File exceeds the 5 MB limit'); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) { this.toast.error('Only JPEG, PNG and PDF files are supported'); return; }

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
          this.applyConvPatch(conv._id, {
            lastMessage:     res.data.message.text,
            lastMessageTime: new Date().toISOString(),
            status:          'waiting_for_user',
          });
          this.selectedConv.update((c) =>
            c ? { ...c, status: 'waiting_for_user' } : c
          );
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
        this.applyConvPatch(conv._id, { status: 'resolved', resolvedAt: new Date().toISOString() });
        this.selectedConv.update((c) =>
          c ? { ...c, status: 'resolved', resolvedAt: new Date().toISOString() } : c
        );
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
        const now = new Date().toISOString();
        this.applyConvPatch(conv._id, { status: 'open', reopenedAt: now });
        this.selectedConv.update((c) =>
          c ? { ...c, status: 'open', reopenedAt: now } : c
        );
        this.toast.success('Conversation reopened');
      },
      error: () => this.toast.error('Failed to reopen conversation'),
    });
  }

  closeConversation(): void {
    const conv = this.selectedConv();
    if (!conv) return;
    this.msgsService.closeConversation(conv._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.applyConvPatch(conv._id, { status: 'closed', closedAt: new Date().toISOString() });
        this.selectedConv.update((c) =>
          c ? { ...c, status: 'closed', closedAt: new Date().toISOString() } : c
        );
        this.toast.success('Conversation closed');
      },
      error: () => this.toast.error('Failed to close conversation'),
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
    // Optimistic: zero the badge immediately so the UI feels instant
    this.conversations.update((list) =>
      list.map((c) => (c._id === convId ? { ...c, unreadByAdmin: 0 } : c))
    );
    // Also zero it on the selected conversation object itself
    if (this.selectedConv()?._id === convId) {
      this.selectedConv.update((c) => c ? { ...c, unreadByAdmin: 0 } : c);
    }
    this.cdr.markForCheck();
    // Persist to server (fire-and-forget — badge is already cleared above)
    this.msgsService.markAsRead(convId).pipe(takeUntil(this.destroy$)).subscribe();
  }

  // ── Socket ─────────────────────────────────────────────────────────────────
  private connectSocket(): void {
    this.socket.connect();

    // ── New message ────────────────────────────────────────────────────────
    this.socket.on('adminMessage:new', (msg: AdminMessage) => {
      // Append to chat view if this conversation is open
      if (msg.conversationId === this.selectedConv()?._id) {
        this.appendMessage(msg);
        // Auto-read: admin is looking at this conversation right now
        const rid = typeof msg.receiverId === 'string'
          ? msg.receiverId
          : (msg.receiverId as any)?._id;
        if (rid === this.currentUserId()) {
          this.markAsRead(msg.conversationId);
        }
      }

      // Update preview + ordering in the sidebar (skip system messages)
      if (msg.messageType !== 'system') {
        const isAdminReceiver = msg.receiverRole === 'admin';
        const isOpen          = this.selectedConv()?._id === msg.conversationId;

        this.applyConvPatch(msg.conversationId, {
          lastMessage:     msg.isDeleted ? '' : msg.text,
          lastMessageTime: msg.createdAt,
          // Only increment unread when the conversation is NOT currently open
          ...(isAdminReceiver && !isOpen
            ? { unreadByAdminDelta: 1 }
            : {}),
        });
      }

      this.cdr.markForCheck();
    });

    // ── Typing ─────────────────────────────────────────────────────────────
    this.socket.on('adminMessage:typing', (payload: any) => {
      if (payload.conversationId === this.selectedConv()?._id) {
        this.typingLabel.set(`${payload.senderName || payload.senderRole} is typing...`);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('adminMessage:stopTyping', (payload: any) => {
      if (payload.conversationId === this.selectedConv()?._id) {
        this.typingLabel.set('');
        this.cdr.markForCheck();
      }
    });

    // ── Read receipts ──────────────────────────────────────────────────────
    this.socket.on('adminMessage:read', (payload: any) => {
      // Mark all messages in this conversation as read
      if (payload?.conversationId === this.selectedConv()?._id) {
        this.messages.update((msgs) => msgs.map((m) => ({ ...m, isRead: true })));
      }
      this.cdr.markForCheck();
    });

    // ── Soft delete ────────────────────────────────────────────────────────
    this.socket.on('adminMessage:deleted', ({ messageId }: any) => {
      this.messages.update((msgs) =>
        msgs.map((m) => (m._id === messageId ? { ...m, isDeleted: true, text: '' } : m))
      );
      this.cdr.markForCheck();
    });

    // ── Status changes (unified) ───────────────────────────────────────────
    this.socket.on('adminConversation:statusChanged',
      ({ conversationId, status, reopenedAt }: any) => {
        this.applyConvPatch(conversationId, {
          status,
          ...(reopenedAt ? { reopenedAt } : {}),
        });
        if (this.selectedConv()?._id === conversationId) {
          this.selectedConv.update((c) =>
            c ? { ...c, status, ...(reopenedAt ? { reopenedAt } : {}) } : c
          );
        }
        this.cdr.markForCheck();
      }
    );

    this.socket.on('adminConversation:resolved', ({ conversationId }: any) => {
      this.applyConvPatch(conversationId, { status: 'resolved' });
      if (this.selectedConv()?._id === conversationId) {
        this.selectedConv.update((c) => c ? { ...c, status: 'resolved' } : c);
      }
      this.cdr.markForCheck();
    });

    this.socket.on('adminConversation:reopened', ({ conversationId }: any) => {
      const now = new Date().toISOString();
      this.applyConvPatch(conversationId, { status: 'open', reopenedAt: now });
      if (this.selectedConv()?._id === conversationId) {
        this.selectedConv.update((c) =>
          c ? { ...c, status: 'open', reopenedAt: now } : c
        );
      }
      this.cdr.markForCheck();
    });

    // ── Presence ───────────────────────────────────────────────────────────
    this.socket.on('presence:updated', ({ userId, isOnline, lastSeen }: any) => {
      this.patchPresence(userId, { isOnline, lastSeen });
      this.conversations.update((list) =>
        list.map((c) =>
          c.userId === userId && c.user
            ? { ...c, user: { ...c.user, isOnline, lastSeen } }
            : c
        )
      );
      if (this.selectedConv()?.userId === userId) {
        this.selectedConv.update((c) =>
          c?.user ? { ...c, user: { ...c.user, isOnline, lastSeen } } : c
        );
      }
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

  private patchPresence(userId: string, data: { isOnline: boolean; lastSeen: string | null }): void {
    this.presenceMap.update((m) => ({ ...m, [userId]: data }));
  }

  /**
   * Central method for updating a single conversation in the list.
   * Handles: lastMessage preview, lastMessageTime, status, reopenedAt,
   * unread counter delta, and automatic reordering so the most recently
   * active conversation always floats to the top.
   *
   * Pass `unreadByAdminDelta: 1` to increment (never call directly with 0 —
   * just omit the key).
   */
  private applyConvPatch(
    convId: string,
    patch: Partial<AdminConversation> & { unreadByAdminDelta?: number }
  ): void {
    this.conversations.update((list) => {
      const idx = list.findIndex((c) => c._id === convId);

      if (idx === -1) {
        // Unknown conversation — fetch it once and insert at top rather
        // than refetching the whole list.
        if (patch.lastMessage !== undefined) {
          // We'll get it via loadConversations only if we have no choice
          this.loadConversations();
        }
        return list;
      }

      const { unreadByAdminDelta, ...rest } = patch;
      const updated: AdminConversation = {
        ...list[idx],
        ...rest,
        unreadByAdmin:
          unreadByAdminDelta !== undefined
            ? (list[idx].unreadByAdmin || 0) + unreadByAdminDelta
            : rest.unreadByAdmin !== undefined
            ? rest.unreadByAdmin
            : list[idx].unreadByAdmin,
      };

      // Build new list with the patched item removed
      const without = list.filter((_, i) => i !== idx);

      // Determine insert position: conversations with activity go to top;
      // resolved / closed stay below open ones (simple two-bucket sort).
      const isActiveStatus = (s: string) =>
        ['open', 'waiting_for_admin', 'waiting_for_user'].includes(s);

      if (isActiveStatus(updated.status)) {
        // Float to the very top
        return [updated, ...without];
      }

      // For resolved/closed: insert after the last active conversation
      const lastActiveIdx = without.reduce(
        (last, c, i) => (isActiveStatus(c.status) ? i : last),
        -1
      );
      const insertAt = lastActiveIdx + 1;
      const result = [...without];
      result.splice(insertAt, 0, updated);
      return result;
    });
  }

  private scrollToBottom(): void {
    try { this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' }); } catch (_) {}
  }

  openConversationById(convId: string): void {
    const existing = this.conversations().find((c) => c._id === convId);
    if (existing) { this.selectConversation(existing); return; }
    this.msgsService.getChatHistory(convId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const conv = res.data.conversation;
        // Insert at top if not already present — applyConvPatch handles ordering
        this.conversations.update((list) => {
          const alreadyIn = list.some((c) => c._id === conv._id);
          return alreadyIn ? list : [conv, ...list];
        });
        this.selectConversation(conv);
      },
      error: () => this.toast.error('Could not open conversation'),
    });
  }

  // ── Presence helpers ───────────────────────────────────────────────────────
  isOnline(userId: string): boolean {
    return this.presenceMap()[userId]?.isOnline ?? false;
  }

  getLastSeen(userId: string): string | null {
    return this.presenceMap()[userId]?.lastSeen ?? null;
  }

  formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) return 'Offline';
    const d = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `Last seen today at ${h}:${m}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `Last seen yesterday at ${h}:${m}`;
    }
    return `Last seen ${d.toLocaleDateString()}`;
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      open:              'Open',
      waiting_for_admin: 'Needs Reply',
      waiting_for_user:  'Waiting for User',
      resolved:          'Resolved',
      closed:            'Closed',
    };
    return labels[status] ?? status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      open:              'status--open',
      waiting_for_admin: 'status--waiting-admin',
      waiting_for_user:  'status--waiting-user',
      resolved:          'status--resolved',
      closed:            'status--closed',
    };
    return classes[status] ?? '';
  }

  isReopened(conv: AdminConversation): boolean {
    return conv.status === 'open' && !!conv.reopenedAt;
  }

  // ── Template helpers ───────────────────────────────────────────────────────
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

  isSystemMessage(msg: AdminMessage): boolean {
    return msg.messageType === 'system';
  }

  getRoleLabel(role: string): string {
    return role === 'family' ? 'Family' : 'Caregiver';
  }

  trackByConv(_: number, c: AdminConversation): string { return c._id; }
  trackByMsg(_: number, m: AdminMessage): string { return m._id; }

  getAvatarUrl(user: any): string { return user?.avatar?.url || ''; }

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
