import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Global toast outlet — place once in admin-layout.html.
 * Renders all toasts emitted via ToastService.
 * Individual components can still use the local ToastNotificationComponent
 * for backward compatibility; this outlet is for new code.
 */
@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-6 right-6 z-[1090] flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-white text-sm font-semibold max-w-sm pointer-events-auto animate-slide-in"
          [class.bg-secondary]="toast.type === 'success'"
          [class.bg-error]="toast.type === 'error'"
          [class.bg-primary]="toast.type === 'info'"
          [class.bg-amber-500]="toast.type === 'warning'">
          <span class="material-symbols-outlined text-[18px] shrink-0" style="font-variation-settings:'FILL' 1;">
            @switch (toast.type) {
              @case ('success') { check_circle }
              @case ('error')   { error }
              @case ('warning') { warning }
              @default          { info }
            }
          </span>
          <span class="flex-1">{{ toast.message }}</span>
          <button (click)="toastService.dismiss(toast.id)"
            class="opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastOutletComponent {
  readonly toastService = inject(ToastService);
}
