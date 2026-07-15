import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminMessagesService } from '../../../core/services/admin-messages.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Reusable "Message" action button.
 * Finds or creates an admin↔user conversation, then navigates
 * to /messages?open=<conversationId>.
 *
 * Usage:
 *   <app-message-button [userId]="family._id" userRole="family" />
 *   <app-message-button [userId]="comp.userId._id" userRole="companion" />
 *
 * Optionally set [compact]="true" to render icon-only with a tooltip
 * (useful for smaller screens).
 */
@Component({
  selector: 'app-message-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="msg-btn"
      [class.msg-btn--compact]="compact"
      [disabled]="loading()"
      (click)="openConversation()"
      [title]="compact ? 'Message' : ''"
    >
      @if (loading()) {
        <span class="msg-btn__spinner"></span>
      } @else {
        <span class="material-symbols-outlined msg-btn__icon">chat</span>
      }
      @if (!compact) {
        <span class="msg-btn__label">Message</span>
      }
    </button>
  `,
  styles: [`
    .msg-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--clr-primary-500, #1F8A8A);
      background: var(--clr-primary-50, #E8F6F6);
      color: var(--clr-primary-600, #197272);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
      white-space: nowrap;
      font-family: inherit;
    }
    .msg-btn:hover:not(:disabled) {
      background: var(--clr-primary-500, #1F8A8A);
      color: #fff;
      box-shadow: 0 2px 8px rgba(31,138,138,0.3);
    }
    .msg-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .msg-btn--compact {
      padding: 8px;
      border-radius: var(--radius-md, 8px);
    }
    .msg-btn__icon {
      font-size: 18px;
      line-height: 1;
    }
    .msg-btn__label {
      line-height: 1;
    }
    .msg-btn__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: mb-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes mb-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class MessageButtonComponent {
  /** The User._id of the family/companion to message */
  @Input({ required: true }) userId!: string;
  /** 'family' | 'companion' */
  @Input() userRole: 'family' | 'companion' = 'family';
  /** Collapse to icon-only on small screens */
  @Input() compact = false;

  private readonly msgsSvc = inject(AdminMessagesService);
  private readonly router  = inject(Router);
  private readonly toast   = inject(ToastService);

  readonly loading = signal(false);

  openConversation(): void {
    if (this.loading()) return;
    this.loading.set(true);

    this.msgsSvc.startConversation(this.userId, this.userRole).subscribe({
      next: (res) => {
        this.loading.set(false);
        const convId = res.data.conversationId;
        // Navigate to messages page with the conversation pre-selected
        this.router.navigate(['/messages'], { queryParams: { open: convId } });
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.error || 'Failed to open conversation. Please try again.';
        this.toast.error(msg);
      },
    });
  }
}
