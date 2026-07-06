import { Injectable, inject, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Lightweight Socket.IO client wrapper for the admin dashboard.
 * Lazily connects on first use, reconnects when token changes.
 * Uses the global `io` function from the Socket.IO CDN script
 * (loaded in index.html), typed minimally here.
 */
declare const io: (url: string, opts: object) => SocketIOClient;

interface SocketIOClient {
  on(event: string, cb: (...args: any[]) => void): void;
  off(event: string, cb?: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  disconnect(): void;
  connected: boolean;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private socket: SocketIOClient | null = null;
  private readonly SERVER_URL = 'http://localhost:5000';

  /** Connect (or return existing connection). */
  connect(): SocketIOClient | null {
    if (this.socket?.connected) return this.socket;

    const token = this.auth.getToken();
    if (!token) return null;

    try {
      this.socket = io(this.SERVER_URL, {
        auth: { token: `Bearer ${token}` },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });

      this.socket.on('connect_error', (err: any) => {
        console.warn('[Socket] connect_error', err?.message);
      });
    } catch (e) {
      console.warn('[Socket] io() not available — make sure socket.io.js is loaded', e);
      return null;
    }

    return this.socket;
  }

  get instance(): SocketIOClient | null {
    return this.socket;
  }

  on(event: string, cb: (...args: any[]) => void): void {
    this.connect()?.on(event, cb);
  }

  off(event: string, cb?: (...args: any[]) => void): void {
    this.socket?.off(event, cb);
  }

  emit(event: string, ...args: any[]): void {
    this.connect()?.emit(event, ...args);
  }

  joinRoom(conversationId: string): void {
    this.emit('adminConversation:join', conversationId);
  }

  leaveRoom(conversationId: string): void {
    this.emit('adminConversation:leave', conversationId);
  }

  sendTyping(payload: { conversationId: string; senderRole: string; senderName: string }): void {
    this.emit('adminMessage:typing', payload);
  }

  sendStopTyping(conversationId: string): void {
    this.emit('adminMessage:stopTyping', { conversationId });
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }
}
