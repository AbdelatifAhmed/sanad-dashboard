import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable confirmation dialog overlay.
 * Usage:
 *   <app-confirm-dialog
 *     [visible]="showConfirm"
 *     title="Delete record"
 *     message="Are you sure? This cannot be undone."
 *     confirmLabel="Delete"
 *     confirmClass="bg-error"
 *     [isSubmitting]="isSaving()"
 *     (confirmed)="onConfirm()"
 *     (cancelled)="showConfirm = false"
 *   />
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="fixed inset-0 bg-black/50 z-[1060] flex items-center justify-center p-4"
        (click)="onBackdrop($event)">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-outline-variant/30"
          (click)="$event.stopPropagation()">
          <!-- Icon + Title -->
          <div class="flex items-center gap-3 mb-4" [ngClass]="iconColorClass">
            <span class="material-symbols-outlined text-[26px]">{{ icon }}</span>
            <h3 class="text-base font-bold text-on-surface">{{ title }}</h3>
          </div>
          <!-- Message -->
          <p class="text-sm text-on-surface-variant leading-relaxed mb-6">{{ message }}</p>
          <!-- Actions -->
          <div class="flex justify-end gap-3">
            <button (click)="cancelled.emit()" [disabled]="isSubmitting"
              class="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container transition-all disabled:opacity-50 cursor-pointer">
              {{ cancelLabel }}
            </button>
            <button (click)="confirmed.emit()" [disabled]="isSubmitting"
              class="px-5 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
              [ngClass]="confirmClass">
              @if (isSubmitting) {
                <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              }
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  @Input() visible = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() confirmClass = 'bg-primary';
  @Input() icon = 'help';
  @Input() iconColorClass = 'text-primary';
  @Input() isSubmitting = false;
  @Input() closeOnBackdrop = true;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdrop(e: MouseEvent): void {
    if (this.closeOnBackdrop) this.cancelled.emit();
  }
}
