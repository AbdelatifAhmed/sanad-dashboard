import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Inline error banner with optional retry button.
 * Usage: <app-error-banner [message]="error()" (retry)="load()" />
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (message) {
      <div class="flex items-center gap-3 p-4 rounded-xl bg-error-container/30 border border-error/20 mb-5">
        <span class="material-symbols-outlined text-error flex-none text-[20px]">error_outline</span>
        <p class="font-body-sm text-body-sm text-on-error-container flex-1">{{ message }}</p>
        @if (showRetry) {
          <button (click)="retry.emit()"
            class="flex items-center gap-1.5 text-error font-label-sm text-label-sm font-semibold hover:underline cursor-pointer flex-none">
            <span class="material-symbols-outlined text-[14px]">refresh</span>
            Retry
          </button>
        }
      </div>
    }
  `,
})
export class ErrorBannerComponent {
  @Input() message: string | null = null;
  @Input() showRetry = true;
  @Output() retry = new EventEmitter<void>();
}
