import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant =
  | 'active' | 'suspended' | 'banned'
  | 'verified' | 'pending' | 'rejected' | 'under_review'
  | 'completed' | 'cancelled' | 'approved'
  | 'success' | 'error' | 'warning' | 'info' | 'neutral';

/**
 * Reusable status badge chip.
 * Usage: <app-status-badge [status]="'active'" />
 * Or with a custom label: <app-status-badge [status]="'verified'" label="Approved" />
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border"
      [ngClass]="badgeClass">
      {{ label || defaultLabel }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: BadgeVariant | string;
  @Input() label?: string;

  get badgeClass(): string {
    switch (this.status) {
      case 'active':
      case 'verified':
      case 'approved':
      case 'success':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'suspended':
      case 'banned':
      case 'rejected':
      case 'cancelled':
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'pending':
      case 'under_review':
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'completed':
      case 'info':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }

  get defaultLabel(): string {
    switch (this.status) {
      case 'active':       return 'Active';
      case 'suspended':
      case 'banned':       return 'Suspended';
      case 'verified':     return 'Verified';
      case 'pending':      return 'Pending';
      case 'rejected':     return 'Rejected';
      case 'under_review': return 'Under Review';
      case 'completed':    return 'Completed';
      case 'cancelled':    return 'Cancelled';
      case 'approved':     return 'Approved';
      default:             return this.status;
    }
  }
}
