import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ConversationStatus =
  | 'open'
  | 'waiting_for_admin'
  | 'waiting_for_user'
  | 'resolved'
  | 'closed';

export type ConversationFilter =
  | 'all'
  | 'families'
  | 'caregivers'
  | 'unread'
  | 'resolved'
  | 'open'
  | 'waiting_for_admin'
  | 'waiting_for_user'
  | 'closed';

export interface ConversationUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'family' | 'companion';
  avatar?: { url?: string; public_id?: string } | null;
  createdAt?: string;
  isBanned?: boolean;
  isOnline?: boolean;
  lastSeen?: string | null;
}

export interface AdminConversation {
  _id: string;
  userId: string;
  userRole: 'family' | 'companion';
  adminId?: string;
  lastMessage: string;
  lastMessageTime: string | null;
  lastMessageSenderId?: string;
  unreadByAdmin: number;
  unreadByUser: number;
  status: ConversationStatus;
  subject?: string;
  reopenedAt?: string | null;
  reopenCount?: number;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: ConversationUser | null;
}

export interface Attachment {
  url: string | null;
  publicId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  attachmentType?: string | null;
}

export interface AdminMessage {
  _id: string;
  conversationId: string;
  senderId: string | ConversationUser;
  senderRole: 'admin' | 'family' | 'companion';
  receiverId: string | ConversationUser;
  receiverRole: 'admin' | 'family' | 'companion';
  messageType: 'text' | 'image' | 'pdf' | 'document' | 'system';
  text: string;
  attachment?: Attachment;
  isRead: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminMessagesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/messages`;

  getConversations(
    filter: ConversationFilter = 'all',
    search = '',
    page = 1,
    limit = 50
  ): Observable<{ status: string; data: { conversations: AdminConversation[]; total: number } }> {
    let params = new HttpParams()
      .set('filter', filter)
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<any>(this.base, { params });
  }

  getChatHistory(
    conversationId: string,
    page = 1,
    limit = 50
  ): Observable<{ status: string; data: { conversation: AdminConversation; messages: AdminMessage[]; total: number } }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<any>(`${this.base}/${conversationId}`, { params });
  }

  sendMessage(body: {
    conversationId?: string;
    userId?: string;
    text: string;
    messageType?: string;
    subject?: string;
  }): Observable<{ status: string; data: { message: AdminMessage; conversationId: string } }> {
    return this.http.post<any>(`${this.base}/send`, body);
  }

  uploadAttachment(conversationId: string, file: File): Observable<{ status: string; data: { message: AdminMessage } }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('conversationId', conversationId);
    return this.http.post<any>(`${this.base}/upload`, fd);
  }

  markAsRead(conversationId: string): Observable<any> {
    return this.http.patch(`${this.base}/read`, { conversationId });
  }

  resolveConversation(conversationId: string): Observable<any> {
    return this.http.patch(`${this.base}/resolve`, { conversationId });
  }

  reopenConversation(conversationId: string): Observable<any> {
    return this.http.patch(`${this.base}/reopen`, { conversationId });
  }

  closeConversation(conversationId: string): Observable<any> {
    return this.http.patch(`${this.base}/close`, { conversationId });
  }

  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete(`${this.base}/${messageId}`);
  }

  startConversation(targetUserId: string, targetUserRole?: string): Observable<{
    status: string;
    data: { conversationId: string; conversation: AdminConversation };
  }> {
    return this.http.post<any>(`${this.base}/start-conversation`, {
      targetUserId,
      ...(targetUserRole ? { targetUserRole } : {}),
    });
  }
}
