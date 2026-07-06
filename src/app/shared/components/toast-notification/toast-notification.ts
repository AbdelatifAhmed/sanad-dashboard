import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ToastState {
  message: string;
  type: 'success' | 'error';
}

/**
 * Fixed-position toast notification.
 * Usage: <app-toast [toast]="toast()" />
 * where toast is a Signal<ToastState | null>
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (toast) {
      <div class="fixed top-6 right-6 z-[1090] flex items-center gap-3 p-4 rounded-xl shadow-xl border text-white max-w-sm animate-slide-in"
        [class.bg-secondary]="toast.type === 'success'"
        [class.bg-error]="toast.type === 'error'">
        <span class="material-symbols-outlined text-[18px] flex-none" style="font-variation-settings:'FILL' 1;">
          {{ toast.type === 'success' ? 'check_circle' : 'error' }}
        </span>
        <span class="font-label-md text-label-md font-semibold">{{ toast.message }}</span>
      </div>
    }
  `,
})
export class ToastNotificationComponent {
  @Input() toast: ToastState | null = null;
}
